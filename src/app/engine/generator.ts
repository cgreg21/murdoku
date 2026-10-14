import { Board, CHARACTERS, Clue, LEVELS, OBJECT_KINDS, Pos, Puzzle, ROOM_NAMES } from './types';
import { adjacent, nearKind, roomAt } from './clues';
import { countSolutions } from './solver';

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;

function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const pick = <T>(arr: T[], rng: Rng): T => arr[Math.floor(rng() * arr.length)];

function makeRooms(n: number, k: number, rng: Rng): number[][] {
  const grid = Array.from({ length: n }, () => new Array<number>(n).fill(-1));
  const cells = shuffle(
    Array.from({ length: n * n }, (_, i) => ({ r: Math.floor(i / n), c: i % n })),
    rng,
  );
  for (let i = 0; i < k; i++) grid[cells[i].r][cells[i].c] = i;
  let free = n * n - k;
  while (free > 0) {
    const frontier: { r: number; c: number; room: number }[] = [];
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        if (grid[r][c] !== -1) continue;
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const v = grid[r + dr]?.[c + dc];
          if (v !== undefined && v >= 0) frontier.push({ r, c, room: v });
        }
      }
    const f = pick(frontier, rng);
    grid[f.r][f.c] = f.room;
    free--;
  }
  return grid;
}

function randomPermutation(board: Board, rng: Rng): number[] | null {
  const n = board.size;
  const used = new Array<boolean>(n).fill(false);
  const res: number[] = [];
  const rec = (r: number): boolean => {
    if (r === n) return true;
    for (const c of shuffle([...Array(n).keys()], rng)) {
      if (used[c] || board.objects[r][c]) continue;
      used[c] = true;
      res.push(c);
      if (rec(r + 1)) return true;
      res.pop();
      used[c] = false;
    }
    return false;
  };
  return rec(0) ? res : null;
}

function buildCluePool(board: Board, sol: Pos[], types: Clue['t'][], neg: boolean, rng: Rng): Clue[] {
  const n = board.size;
  const pool: Clue[] = [];
  const has = (t: Clue['t']) => types.includes(t);
  const roomCount = Math.max(...board.rooms.flat()) + 1;
  for (let a = 0; a < n; a++) {
    const p = sol[a];
    if (has('room')) {
      pool.push({ t: 'room', a, room: roomAt(board, p), neg: false });
      if (neg) {
        const other = pick([...Array(roomCount).keys()].filter((x) => x !== roomAt(board, p)), rng);
        pool.push({ t: 'room', a, room: other, neg: true });
      }
    }
    if (has('row')) pool.push({ t: 'row', a, row: p.r });
    if (has('col')) pool.push({ t: 'col', a, col: p.c });
    if (has('near'))
      for (const k of OBJECT_KINDS) if (nearKind(board, p, k.id)) pool.push({ t: 'near', a, kind: k.id });
    if (has('edge')) {
      if (board.doorCells[p.r][p.c]) pool.push({ t: 'edge', a, kind: 'door' });
      if (board.windowCells[p.r][p.c]) pool.push({ t: 'edge', a, kind: 'window' });
    }
    if (has('alone') && sol.every((q, i) => i === a || roomAt(board, q) !== roomAt(board, p)))
      pool.push({ t: 'alone', a });
    for (let b = 0; b < n; b++) {
      if (a === b) continue;
      const q = sol[b];
      if (has('adj') && adjacent(p, q) && a < b) pool.push({ t: 'adj', a, b, neg: false });
      if (has('adj') && neg && !adjacent(p, q) && a < b && rng() < 0.4) pool.push({ t: 'adj', a, b, neg: true });
      const same = roomAt(board, p) === roomAt(board, q);
      if (has('same') && a < b && (same || neg)) pool.push({ t: 'same', a, b, neg: !same });
      if (has('left') && p.c < q.c) pool.push({ t: 'left', a, b });
      if (has('above') && p.r < q.r) pool.push({ t: 'above', a, b });
    }
  }
  return pool;
}

const grid = (n: number) => Array.from({ length: n }, () => new Array<boolean>(n).fill(false));

function addOpenings(board: Board, rng: Rng) {
  const n = board.size;
  const free = (r: number, c: number) => !board.objects[r][c];
  const byPair = new Map<string, { r: number; c: number; side: string; a: number; b: number }[]>();
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      if (!free(r, c)) continue;
      const cands: [number, number, string][] = [[r, c + 1, 'r'], [r + 1, c, 'b']];
      for (const [r2, c2, side] of cands) {
        if (r2 >= n || c2 >= n || !free(r2, c2)) continue;
        const a = board.rooms[r][c];
        const b = board.rooms[r2][c2];
        if (a === b) continue;
        const key = Math.min(a, b) + '-' + Math.max(a, b);
        if (!byPair.has(key)) byPair.set(key, []);
        byPair.get(key)!.push({ r, c, side, a, b });
      }
    }
  // Arbre couvrant (toutes les pièces accessibles si possible) + quelques portes en plus.
  const parent = [...Array(Math.max(...board.rooms.flat()) + 1).keys()];
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  for (const list of shuffle([...byPair.values()], rng)) {
    const e = pick(list, rng);
    const joined = find(e.a) !== find(e.b);
    if (!joined && rng() > 0.25) continue;
    parent[find(e.a)] = find(e.b);
    board.doors.push(`${e.r},${e.c},${e.side}`);
    board.doorCells[e.r][e.c] = true;
    const r2 = e.side === 'b' ? e.r + 1 : e.r;
    const c2 = e.side === 'r' ? e.c + 1 : e.c;
    board.doorCells[r2][c2] = true;
  }
  const edges: [number, number, string][] = [];
  for (let i = 0; i < n; i++)
    for (const [r, c, side] of [[0, i, 't'], [n - 1, i, 'b'], [i, 0, 'l'], [i, n - 1, 'r']] as [number, number, string][])
      if (free(r, c)) edges.push([r, c, side]);
  const count = Math.max(2, Math.round(n * 0.9));
  for (const [r, c, side] of shuffle(edges, rng).slice(0, count)) {
    board.windows.push(`${r},${c},${side}`);
    board.windowCells[r][c] = true;
  }
}

function tryGenerate(level: number, rng: Rng, seed: number): Puzzle | null {
  const cfg = LEVELS[level - 1];
  const n = cfg.size;
  const rooms = makeRooms(n, cfg.rooms, rng);
  const objects: (string | null)[][] = Array.from({ length: n }, () => new Array<string | null>(n).fill(null));
  const cells = shuffle(
    Array.from({ length: n * n }, (_, i) => ({ r: Math.floor(i / n), c: i % n })),
    rng,
  );
  const kinds = shuffle(OBJECT_KINDS, rng);
  for (let i = 0; i < cfg.objects; i++) objects[cells[i].r][cells[i].c] = kinds[i % kinds.length].id;
  const board: Board = {
    size: n,
    rooms,
    roomNames: shuffle(ROOM_NAMES, rng).slice(0, cfg.rooms),
    objects,
    doors: [],
    windows: [],
    doorCells: grid(n),
    windowCells: grid(n),
  };
  addOpenings(board, rng);

  const perm = randomPermutation(board, rng);
  if (!perm) return null;
  const order = shuffle([...Array(n).keys()], rng); // order[row] = personnage
  const sol: Pos[] = new Array(n);
  perm.forEach((c, r) => (sol[order[r]] = { r, c }));
  // La victime (id 0) doit être seule avec un meurtrier.
  const victimRoom = roomAt(board, sol[0]);
  const inRoom = sol.map((p, i) => ({ p, i })).filter((x) => roomAt(board, x.p) === victimRoom && x.i !== 0);
  if (inRoom.length !== 1) return null;

  const pool = shuffle(buildCluePool(board, sol, cfg.clueTypes, cfg.allowNegative, rng), rng);
  const clues: Clue[] = [];
  let unique = false;
  for (let i = 0; i < pool.length; i++) {
    clues.push(pool[i]);
    if (clues.length >= n - 1 && countSolutions(board, clues) === 1) {
      unique = true;
      break;
    }
  }
  if (!unique) return null;

  for (const clue of shuffle(clues, rng)) {
    if (rng() > cfg.pruneRatio) continue;
    const rest = clues.filter((c) => c !== clue);
    if (countSolutions(board, rest) === 1) clues.splice(0, clues.length, ...rest);
  }

  return {
    seed,
    level,
    board,
    characters: CHARACTERS.slice(0, n),
    victim: 0,
    killer: inRoom[0].i,
    clues: shuffle(clues, rng),
    solution: sol,
  };
}

export function generatePuzzle(level: number, seed = Math.floor(Math.random() * 2 ** 31)): Puzzle {
  const rng = mulberry32(seed);
  for (let i = 0; i < 500; i++) {
    const p = tryGenerate(level, rng, seed);
    if (p) return p;
  }
  return generatePuzzle(level, seed + 1);
}
