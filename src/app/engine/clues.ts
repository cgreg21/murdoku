import { Board, Clue, Pos } from './types';

export function roomCells(board: Board, room: number): number {
  let n = 0;
  for (const row of board.rooms) for (const r of row) if (r === room) n++;
  return n;
}

export function nearKind(board: Board, p: Pos, kind: string): boolean {
  const d = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  return d.some(([dr, dc]) => board.objects[p.r + dr]?.[p.c + dc] === kind);
}

export function adjacent(a: Pos, b: Pos): boolean {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
}

export function roomAt(board: Board, p: Pos): number {
  return board.rooms[p.r][p.c];
}

export function clueChars(c: Clue): number[] {
  switch (c.t) {
    case 'room':
    case 'row':
    case 'col':
    case 'alone':
    case 'near':
      return [c.a];
    default:
      return [c.a, c.b];
  }
}

/** Évalue un indice sur une solution complète. `pos[i]` est la position du personnage i. */
export function holds(board: Board, pos: (Pos | undefined)[], clue: Clue): boolean {
  const a = pos[clue.a]!;
  switch (clue.t) {
    case 'room':
      return (roomAt(board, a) === clue.room) !== clue.neg;
    case 'row':
      return a.r === clue.row;
    case 'col':
      return a.c === clue.col;
    case 'near':
      return nearKind(board, a, clue.kind);
    case 'adj':
      return adjacent(a, pos[clue.b]!) !== clue.neg;
    case 'same':
      return (roomAt(board, a) === roomAt(board, pos[clue.b]!)) !== clue.neg;
    case 'left':
      return a.c < pos[clue.b]!.c;
    case 'above':
      return a.r < pos[clue.b]!.r;
    case 'alone': {
      const ra = roomAt(board, a);
      return pos.every((p, i) => i === clue.a || !p || roomAt(board, p) !== ra);
    }
  }
}

/** Les indices de type "alone" dépendent de tous les personnages. */
export function needsAll(c: Clue): boolean {
  return c.t === 'alone';
}
