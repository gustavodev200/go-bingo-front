import type { Socket } from 'socket.io-client';
import {
  VoiceServerEvents,
  type Ack,
  type VoiceClientAckData,
  type VoiceGame,
  type VoiceIceServer,
  type VoicePeer,
  type VoiceServerEventPayloads,
  type VoiceSignalData,
} from '@/contracts';

const ACK_TIMEOUT_MS = 5_000;
const LEVEL_POLL_MS = 150;
/** RMS of the time-domain signal above which someone counts as speaking. */
const SPEAKING_LEVEL = 0.04;

export type VoiceStatus = 'off' | 'joining' | 'live';

export interface VoicePeerView extends VoicePeer {
  speaking: boolean;
  connected: boolean;
}

export interface VoiceView {
  status: VoiceStatus;
  muted: boolean;
  /** false = listening only (no microphone or permission denied). */
  hasMic: boolean;
  speaking: boolean;
  peers: VoicePeerView[];
}

export const VOICE_OFF: VoiceView = { status: 'off', muted: false, hasMic: false, speaking: false, peers: [] };

export interface VoiceDeps {
  socket: Socket;
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  createPeerConnection: (config: RTCConfiguration) => RTCPeerConnection;
  /** Plays a remote stream; returns a function that stops it. */
  play: (stream: MediaStream) => () => void;
  /** Audio level (0..1) of a stream, or null when it cannot be measured. */
  meter: (stream: MediaStream) => { level(): number; stop(): void } | null;
}

export interface VoiceEvents {
  onChange(view: VoiceView): void;
  /** Something the player should know (mic denied, kicked out, channel full). */
  onNotice(message: string): void;
}

interface Peer {
  info: VoicePeer;
  pc: RTCPeerConnection;
  /** This side sent the offer (the newcomer), so it also restarts ICE. */
  initiator: boolean;
  pendingCandidates: RTCIceCandidateInit[];
  stopAudio?: () => void;
  meter?: { level(): number; stop(): void } | null;
  speaking: boolean;
}

/**
 * Full-mesh voice chat for one game room: one RTCPeerConnection per other
 * player, negotiated through the /voice namespace. The newcomer offers to
 * everyone already in the channel, so two peers never offer to each other.
 */
export class VoiceEngine {
  private readonly peers = new Map<string, Peer>();
  private readonly bound: [string, (...args: never[]) => void][] = [];
  private status: VoiceStatus = 'off';
  private muted = false;
  private stream: MediaStream | null = null;
  private selfMeter: { level(): number; stop(): void } | null = null;
  private selfSpeaking = false;
  private iceServers: VoiceIceServer[] = [];
  private levelTimer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly game: VoiceGame,
    private readonly code: string,
    private readonly deps: VoiceDeps,
    private readonly events: VoiceEvents,
  ) {}

  /** Asks for the microphone (falls back to listening only) and enters the channel. */
  async start(muted = false): Promise<void> {
    if (this.status !== 'off') return;
    this.status = 'joining';
    this.muted = muted;
    this.emit();
    try {
      this.stream = await this.deps.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      this.applyMute();
      this.selfMeter = this.deps.meter(this.stream);
    } catch {
      this.stream = null;
      this.events.onNotice('Sem acesso ao microfone: você vai só ouvir');
    }
    if (this.status !== 'joining') return this.releaseMedia();

    const { socket } = this.deps;
    this.listen(VoiceServerEvents.PEER_JOINED, (p: VoiceServerEventPayloads['voice:peer_joined']) => this.onPeerJoined(p));
    this.listen(VoiceServerEvents.PEER_LEFT, ({ peerId }: VoiceServerEventPayloads['voice:peer_left']) => this.closePeer(peerId));
    this.listen(VoiceServerEvents.PEER_UPDATED, ({ peerId, muted: m }: VoiceServerEventPayloads['voice:peer_updated']) => {
      const peer = this.peers.get(peerId);
      if (!peer) return;
      peer.info.muted = m;
      this.emit();
    });
    this.listen(VoiceServerEvents.SIGNAL, (msg: VoiceServerEventPayloads['voice:signal']) => void this.onSignal(msg.from, msg.data));
    this.listen(VoiceServerEvents.REMOVED, ({ reason }: VoiceServerEventPayloads['voice:removed']) => {
      this.events.onNotice(reason === 'replaced' ? 'Você entrou na voz por outra aba' : 'Você saiu da voz');
      this.stop(false);
    });
    // A new connection is a new peer id: drop every link and join again as a newcomer.
    this.listen('connect', () => {
      this.closeAllPeers();
      void this.join();
    });
    this.listen('connect_error', (error: Error) => {
      if (error.message !== 'UNAUTHENTICATED') return;
      this.events.onNotice('Sua sessão expirou. Entre de novo.');
      this.stop(false);
    });
    this.listen('disconnect', () => {
      this.closeAllPeers();
      if (this.status === 'live') this.status = 'joining';
      this.emit();
    });
    this.levelTimer = setInterval(() => this.pollLevels(), LEVEL_POLL_MS);

    if (socket.connected) await this.join();
    else socket.connect();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyMute();
    if (this.status === 'live') void this.call('voice:mute', { muted });
    this.emit();
  }

  /** Leaves the channel and releases the microphone. */
  stop(notifyServer = true): void {
    if (this.status === 'off') return;
    const wasLive = this.status === 'live';
    this.status = 'off';
    for (const [event, fn] of this.bound) this.deps.socket.off(event, fn as never);
    this.bound.length = 0;
    clearInterval(this.levelTimer);
    this.closeAllPeers();
    this.releaseMedia();
    if (notifyServer && wasLive && this.deps.socket.connected) void this.call('voice:leave');
    this.deps.socket.disconnect();
    this.emit();
  }

  private async join(): Promise<void> {
    const res = await this.call('voice:join', { game: this.game, code: this.code, muted: this.muted || !this.stream });
    if (this.status === 'off') return;
    if (!res.ok) {
      this.events.onNotice(res.error.message);
      this.stop(false);
      return;
    }
    this.iceServers = res.data.iceServers;
    this.status = 'live';
    for (const info of res.data.peers) void this.offerTo(info);
    this.emit();
  }

  private onPeerJoined(info: VoicePeer): void {
    // Its offer may have arrived first (then the link already exists): only fill in who it is.
    const known = this.peers.get(info.peerId);
    if (known) known.info = { ...info };
    else this.peers.set(info.peerId, this.newPeer(info, false));
    this.emit();
  }

  private async offerTo(info: VoicePeer): Promise<void> {
    const peer = this.newPeer(info, true);
    this.peers.set(info.peerId, peer);
    const track = this.stream?.getAudioTracks()[0];
    if (track && this.stream) peer.pc.addTransceiver(track, { direction: 'sendrecv', streams: [this.stream] });
    else peer.pc.addTransceiver('audio', { direction: 'recvonly' });
    await this.sendOffer(peer);
  }

  private async sendOffer(peer: Peer, iceRestart = false): Promise<void> {
    try {
      const offer = await peer.pc.createOffer(iceRestart ? { iceRestart: true } : undefined);
      await peer.pc.setLocalDescription(offer);
      this.signal(peer.info.peerId, { kind: 'offer', sdp: offer.sdp ?? '' });
    } catch {
      this.closePeer(peer.info.peerId);
    }
  }

  private async onSignal(from: string, data: VoiceSignalData): Promise<void> {
    if (this.status !== 'live') return;
    let peer = this.peers.get(from);
    try {
      if (data.kind === 'offer') {
        if (!peer) {
          // Offer from someone we were not told about yet (event order): it is a newcomer.
          peer = this.newPeer({ peerId: from, userId: '', nickname: '…', muted: false }, false);
          this.peers.set(from, peer);
          this.emit();
        }
        await peer.pc.setRemoteDescription({ type: 'offer', sdp: data.sdp });
        await this.flushCandidates(peer);
        const track = this.stream?.getAudioTracks()[0];
        const transceiver = peer.pc.getTransceivers().find((t) => t.receiver.track.kind === 'audio');
        if (track && transceiver && !transceiver.sender.track) {
          await transceiver.sender.replaceTrack(track);
          transceiver.direction = 'sendrecv';
        }
        const answer = await peer.pc.createAnswer();
        await peer.pc.setLocalDescription(answer);
        this.signal(from, { kind: 'answer', sdp: answer.sdp ?? '' });
      } else if (data.kind === 'answer') {
        if (!peer) return;
        await peer.pc.setRemoteDescription({ type: 'answer', sdp: data.sdp });
        await this.flushCandidates(peer);
      } else {
        if (!peer) return;
        const candidate: RTCIceCandidateInit = { candidate: data.candidate, sdpMid: data.sdpMid, sdpMLineIndex: data.sdpMLineIndex };
        if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(candidate);
        else peer.pendingCandidates.push(candidate);
      }
    } catch {
      // A broken negotiation only loses this one link; the rest of the channel keeps going.
    }
  }

  private async flushCandidates(peer: Peer): Promise<void> {
    const queued = peer.pendingCandidates;
    peer.pendingCandidates = [];
    for (const c of queued) await peer.pc.addIceCandidate(c).catch(() => undefined);
  }

  private newPeer(info: VoicePeer, initiator: boolean): Peer {
    const pc = this.deps.createPeerConnection({ iceServers: this.iceServers });
    const peer: Peer = { info: { ...info }, pc, initiator, pendingCandidates: [], speaking: false };
    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      this.signal(info.peerId, {
        kind: 'candidate',
        candidate: e.candidate.candidate,
        sdpMid: e.candidate.sdpMid,
        sdpMLineIndex: e.candidate.sdpMLineIndex,
      });
    };
    pc.ontrack = (e) => {
      if (this.peers.get(info.peerId) !== peer) return;
      const remote = e.streams[0] ?? new MediaStream([e.track]);
      peer.stopAudio?.();
      peer.meter?.stop();
      peer.stopAudio = this.deps.play(remote);
      peer.meter = this.deps.meter(remote);
    };
    pc.onconnectionstatechange = () => {
      if (this.peers.get(info.peerId) !== peer) return;
      if (pc.connectionState === 'failed' && peer.initiator) {
        pc.restartIce();
        void this.sendOffer(peer, true);
      }
      this.emit();
    };
    return peer;
  }

  private closePeer(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (!peer) return;
    this.peers.delete(peerId);
    peer.stopAudio?.();
    peer.meter?.stop();
    peer.pc.onicecandidate = null;
    peer.pc.ontrack = null;
    peer.pc.onconnectionstatechange = null;
    peer.pc.close();
    this.emit();
  }

  private closeAllPeers(): void {
    for (const peerId of [...this.peers.keys()]) this.closePeer(peerId);
  }

  private releaseMedia(): void {
    this.selfMeter?.stop();
    this.selfMeter = null;
    this.selfSpeaking = false;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  private applyMute(): void {
    this.stream?.getAudioTracks().forEach((t) => (t.enabled = !this.muted));
  }

  private pollLevels(): void {
    let changed = false;
    const self = !this.muted && (this.selfMeter?.level() ?? 0) > SPEAKING_LEVEL;
    if (self !== this.selfSpeaking) {
      this.selfSpeaking = self;
      changed = true;
    }
    for (const peer of this.peers.values()) {
      const speaking = !peer.info.muted && (peer.meter?.level() ?? 0) > SPEAKING_LEVEL;
      if (speaking !== peer.speaking) {
        peer.speaking = speaking;
        changed = true;
      }
    }
    if (changed) this.emit();
  }

  private listen<T>(event: string, fn: (payload: T) => void): void {
    this.deps.socket.on(event, fn as never);
    this.bound.push([event, fn as never]);
  }

  private signal(to: string, data: VoiceSignalData): void {
    void this.call('voice:signal', { to, data });
  }

  private async call<E extends keyof VoiceClientAckData>(event: E, payload: object = {}): Promise<Ack<VoiceClientAckData[E]>> {
    try {
      return (await this.deps.socket.timeout(ACK_TIMEOUT_MS).emitWithAck(event, payload)) as Ack<VoiceClientAckData[E]>;
    } catch {
      return { ok: false, error: { code: 'INTERNAL', message: 'Sem resposta do servidor de voz' } };
    }
  }

  private emit(): void {
    this.events.onChange({
      status: this.status,
      muted: this.muted,
      hasMic: this.stream !== null,
      speaking: this.selfSpeaking,
      peers: [...this.peers.values()].map((p) => ({
        ...p.info,
        speaking: p.speaking,
        connected: p.pc.connectionState === 'connected',
      })),
    });
  }
}
