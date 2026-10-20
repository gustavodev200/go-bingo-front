'use client';

import { Crown } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { damasCol, damasRow, damasSquareName, isDarkSquare, type DamasCell, type DamasColor, type DamasLastMove, type DamasMove } from '@/contracts';
import { cn } from '@/lib/utils';
import { colorOfCell, isKing, movablePieces, nextTargets, onlyMovable, pendingCaptures, screenOrder, tap, type Selection } from './board-logic';
import styles from './damas.module.css';

const PIECE_NAME: Record<Exclude<DamasCell, '.'>, string> = { w: 'pedra branca', W: 'dama branca', b: 'pedra preta', B: 'dama preta' };

/** A piece, alone (used on the board, in the lobby art and in the player bars). */
export function PieceView({ cell, className, style }: { cell: Exclude<DamasCell, '.'>; className?: string; style?: CSSProperties }) {
  return (
    <span aria-hidden className={cn(styles.piece, colorOfCell(cell) === 'white' ? styles.white : styles.black, className)} style={style}>
      {isKing(cell) && <Crown className={styles.crown} strokeWidth={2.6} fill="currentColor" />}
    </span>
  );
}

function preselect(moves: readonly DamasMove[]): Selection | null {
  const only = onlyMovable(moves);
  return only === null ? null : { from: only, path: [] };
}

interface CellProps {
  square: number;
  cell: DamasCell;
  /** Offset (in squares) the piece slides in from, when it just moved here. */
  slide: { dx: number; dy: number; id: number } | null;
  /** Piece just captured here (fades out). */
  ghost: Exclude<DamasCell, '.'> | null;
  movable: boolean;
  lifted: boolean;
  hint: boolean;
  target: 'step' | 'capture' | null;
  doomed: boolean;
  last: 'from' | 'to' | null;
  coordRow: string | null;
  coordCol: string | null;
  onTap(square: number): void;
}

const Cell = memo(function Cell({ square, cell, slide, ghost, movable, lifted, hint, target, doomed, last, coordRow, coordCol, onTap }: CellProps) {
  const dark = isDarkSquare(square);
  const interactive = movable || lifted || target !== null;
  const piece = cell === '.' ? null : cell;
  const label = `${damasSquareName(square)}${piece ? `, ${PIECE_NAME[piece]}` : ''}${target ? ', mover para cá' : ''}`;
  const content = (
    <>
      {coordRow && <span className={cn(styles.coord, 'top-[6%] left-[7%]')}>{coordRow}</span>}
      {coordCol && <span className={cn(styles.coord, 'right-[7%] bottom-[6%]')}>{coordCol}</span>}
      {ghost && <PieceView cell={ghost} className={styles.ghost} />}
      {piece && (
        <PieceView
          key={slide ? `slide-${slide.id}` : 'still'}
          cell={piece}
          className={cn(movable && styles.movable, lifted && styles.lifted, !lifted && hint && styles.hintRing, doomed && styles.doomed, slide && styles.slide)}
          style={slide ? ({ '--dx': `${slide.dx * 128}%`, '--dy': `${slide.dy * 128}%` } as CSSProperties) : undefined}
        />
      )}
      {target && <span className={cn(styles.target, target === 'capture' && styles.targetCapture)} />}
    </>
  );
  const tone = cn(styles.cell, dark ? styles.dark : styles.light, last === 'to' && styles.last, last === 'from' && styles.lastFrom, lifted && styles.selected);
  if (!interactive)
    return (
      <div className={tone} aria-label={dark ? label : undefined} role={dark ? 'gridcell' : 'presentation'}>
        {content}
      </div>
    );
  return (
    <button type="button" className={cn(tone, 'focus-visible:z-10 focus-visible:outline-3 focus-visible:outline-amber-300')} aria-label={label} aria-pressed={movable ? lifted : undefined} onClick={() => onTap(square)}>
      {content}
    </button>
  );
});

/**
 * The 8x8 board seen from my side (my pieces at the bottom). Only the moves the
 * server listed can be made: tap a piece, then the square(s) it lands on; a
 * multi-capture is chosen one jump at a time.
 */
export function Board({
  board,
  orientation,
  moves,
  lastMove,
  moveId,
  onMove,
}: {
  board: string;
  orientation: DamasColor;
  /** My legal moves (empty when it is not my turn). */
  moves: DamasMove[];
  lastMove: DamasLastMove | null;
  /** Grows with every move (the ply count), so each move animates once. */
  moveId: number;
  onMove(move: DamasMove): void;
}) {
  const [selection, setSelection] = useState<Selection | null>(() => preselect(moves));
  // A new list of moves (new turn) drops the old selection and preselects a lone movable piece.
  const [movesSeen, setMovesSeen] = useState(moves);
  if (movesSeen !== moves) {
    setMovesSeen(moves);
    setSelection(preselect(moves));
  }
  const selRef = useRef(selection);
  const movesRef = useRef(moves);
  const onMoveRef = useRef(onMove);
  useEffect(() => {
    selRef.current = selection;
    movesRef.current = moves;
    onMoveRef.current = onMove;
  });

  const onTap = useCallback((square: number) => {
    const result = tap(movesRef.current, selRef.current, square);
    if (result.kind === 'move') {
      setSelection(null);
      onMoveRef.current(result.move);
    } else setSelection(result.selection);
  }, []);

  const order = useMemo(() => screenOrder(orientation), [orientation]);
  const movable = useMemo(() => movablePieces(moves), [moves]);
  const capturing = (moves[0]?.captures.length ?? 0) > 0;
  const targets = useMemo(() => (selection ? nextTargets(moves, selection) : new Set<number>()), [moves, selection]);
  const doomed = useMemo(() => (selection ? pendingCaptures(moves, selection) : new Set<number>()), [moves, selection]);
  // While a capture is half chosen, the piece is drawn on its current landing square.
  const liftedAt = selection ? (selection.path.at(-1) ?? selection.from) : null;
  const flip = orientation === 'black' ? -1 : 1;
  const lastTo = lastMove ? lastMove.path[lastMove.path.length - 1] : null;

  return (
    <div className={cn(styles.board, 'w-full')}>
      <div className={styles.grid} role="grid" aria-label={`Tabuleiro${capturing && moves.length > 0 ? ': captura obrigatória' : ''}`}>
        {order.map((square, i) => {
          let cell = board[square] as DamasCell;
          if (selection && selection.path.length > 0) {
            if (square === selection.from) cell = '.';
            if (square === liftedAt) cell = board[selection.from] as DamasCell;
          }
          const fresh = lastMove && square === lastTo && cell !== '.' && !(selection && selection.path.length > 0);
          const slide = fresh ? { dx: flip * (damasCol(lastMove.from) - damasCol(square)), dy: flip * (damasRow(lastMove.from) - damasRow(square)), id: moveId } : null;
          const ghost = lastMove && lastMove.captures.includes(square) && cell === '.' ? (colorOfCell(board[lastTo!] as DamasCell) === 'white' ? 'b' : 'w') : null;
          const target = targets.has(square) ? (capturing ? 'capture' : 'step') : null;
          return (
            <Cell
              key={square}
              square={square}
              cell={cell}
              slide={slide}
              ghost={ghost}
              movable={movable.has(square) && !(selection && selection.path.length > 0)}
              lifted={square === liftedAt}
              hint={capturing && movable.has(square)}
              target={target}
              doomed={doomed.has(square)}
              last={square === lastTo ? 'to' : lastMove && square === lastMove.from ? 'from' : null}
              coordRow={i % 8 === 0 ? String(8 - damasRow(square)) : null}
              coordCol={i >= 56 ? 'abcdefgh'[damasCol(square)] : null}
              onTap={onTap}
            />
          );
        })}
      </div>
    </div>
  );
}
