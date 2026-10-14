import { Board, Clue, Pos } from './types';
import { clueChars, holds, needsAll } from './clues';

/**
 * Compte les solutions (jusqu'à `limit`). Règles : un personnage par ligne et par colonne,
 * pas sur un objet, et la victime (id 0) partage sa pièce avec exactement une autre personne.
 * Retourne -1 si le budget de nœuds est dépassé.
 */
export function countSolutions(board: Board, clues: Clue[], limit = 2, budget = 100000): number {
  const n = board.size;
  const rowUsed = new Array<boolean>(n).fill(false);
  const colUsed = new Array<boolean>(n).fill(false);
  const pos: (Pos | undefined)[] = new Array(n).fill(undefined);

  // Indices vérifiés dès que leur dernier personnage (index max) est placé.
  const byLast: Clue[][] = Array.from({ length: n }, () => []);
  const finals: Clue[] = [];
  for (const c of clues) {
    if (needsAll(c)) finals.push(c);
    else byLast[Math.max(...clueChars(c))].push(c);
  }

  let found = 0;
  let nodes = 0;
  let aborted = false;

  const roomCount = (room: number) => pos.filter((p) => p && board.rooms[p.r][p.c] === room).length;

  const rec = (i: number): void => {
    if (found >= limit || aborted) return;
    if (i === n) {
      if (roomCount(board.rooms[pos[0]!.r][pos[0]!.c]) !== 2) return;
      if (finals.every((c) => holds(board, pos, c))) found++;
      return;
    }
    for (let r = 0; r < n; r++) {
      if (rowUsed[r]) continue;
      for (let c = 0; c < n; c++) {
        if (colUsed[c] || board.objects[r][c]) continue;
        if (++nodes > budget) {
          aborted = true;
          return;
        }
        pos[i] = { r, c };
        if (byLast[i].every((cl) => holds(board, pos, cl))) {
          rowUsed[r] = colUsed[c] = true;
          rec(i + 1);
          rowUsed[r] = colUsed[c] = false;
        }
        pos[i] = undefined;
        if (found >= limit || aborted) return;
      }
    }
  };
  rec(0);
  return aborted ? -1 : found;
}

