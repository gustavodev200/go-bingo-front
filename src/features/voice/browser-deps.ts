import type { Socket } from 'socket.io-client';
import type { VoiceDeps } from './voice-engine';

let audioContext: AudioContext | null = null;

/** WebRTC and the microphone need a secure page (https or localhost) and a browser that has them. */
export function voiceSupported(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext && typeof RTCPeerConnection !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function';
}

export function browserVoiceDeps(socket: Socket): VoiceDeps {
  return {
    socket,
    getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
    createPeerConnection: (config) => new RTCPeerConnection(config),
    play: (stream) => {
      const audio = new Audio();
      audio.autoplay = true;
      audio.srcObject = stream;
      // Joining is a click, so autoplay is allowed; a block here only costs this one voice.
      void audio.play().catch(() => undefined);
      return () => {
        audio.pause();
        audio.srcObject = null;
      };
    },
    meter: (stream) => {
      try {
        audioContext ??= new AudioContext();
        void audioContext.resume();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        const samples = new Float32Array(analyser.fftSize);
        return {
          level() {
            analyser.getFloatTimeDomainData(samples);
            let sum = 0;
            for (const v of samples) sum += v * v;
            return Math.sqrt(sum / samples.length);
          },
          stop() {
            source.disconnect();
          },
        };
      } catch {
        return null;
      }
    },
  };
}
