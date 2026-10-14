import { Injectable, computed, signal } from '@angular/core';
import { generatePuzzle } from './engine/generator';
import { Pos, Puzzle } from './engine/types';

export type Tool = number | 'mark' | null;

interface Snapshot {
  placements: (Pos | null)[];
  marks: string[];
}

interface SaveData {
  puzzle: Puzzle;
  placements: (Pos | null)[];
  marks: string[];
  crossed: number[];
  elapsed: number;
  solved: boolean;
}

const SAVE_KEY = 'murdoku-save-v1';
const BEST_KEY = 'murdoku-best-v1';

@Injectable({ providedIn: 'root' })
export class GameService {
  readonly puzzle = signal<Puzzle | null>(null);
  readonly placements = signal<(Pos | null)[]>([]);
  readonly marks = signal<Set<string>>(new Set());
  readonly crossed = signal<Set<number>>(new Set());
  readonly tool = signal<Tool>(null);
  readonly elapsed = signal(0);
  readonly solved = signal(false);
  readonly loading = signal(false);
  readonly errors = signal<Set<number>>(new Set());
  readonly best = signal<Record<number, number>>(this.readBest());

  private history: Snapshot[] = [];
  readonly canUndo = signal(false);
  private worker?: Worker;
  private timer?: ReturnType<typeof setInterval>;
  private errorTimer?: ReturnType<typeof setTimeout>;

  readonly conflicts = computed(() => {
    const res = new Set<number>();
    const pl = this.placements();
    pl.forEach((a, i) => {
      if (!a) return;
      pl.forEach((b, j) => {
        if (b && i !== j && (a.r === b.r || a.c === b.c)) res.add(i);
      });
    });
    return res;
  });

  readonly placedCount = computed(() => this.placements().filter(Boolean).length);

  constructor() {
    this.timer = setInterval(() => {
      if (this.puzzle() && !this.solved() && !document.hidden) {
        this.elapsed.update((e) => e + 1);
        if (this.elapsed() % 5 === 0) this.save();
      }
    }, 1000);
  }

  hasSave(): boolean {
    try {
      return !!localStorage.getItem(SAVE_KEY);
    } catch {
      return false;
    }
  }

  resume(): boolean {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const s: SaveData = JSON.parse(raw);
      this.load(s.puzzle);
      this.placements.set(s.placements);
      this.marks.set(new Set(s.marks));
      this.crossed.set(new Set(s.crossed));
      this.elapsed.set(s.elapsed);
      this.solved.set(s.solved);
      return true;
    } catch {
      return false;
    }
  }

  newGame(level: number): Promise<void> {
    this.loading.set(true);
    return this.generate(level)
      .then((p) => this.load(p))
      .finally(() => this.loading.set(false));
  }

  private generate(level: number): Promise<Puzzle> {
    if (typeof Worker === 'undefined') {
      return new Promise((res) => setTimeout(() => res(generatePuzzle(level)), 20));
    }
    return new Promise<Puzzle>((resolve, reject) => {
      this.worker?.terminate();
      const w = new Worker(new URL('./engine/generator.worker', import.meta.url), { type: 'module' });
      this.worker = w;
      w.onmessage = ({ data }) => {
        w.terminate();
        resolve(data as Puzzle);
      };
      w.onerror = (e) => {
        w.terminate();
        reject(e);
      };
      w.postMessage({ level });
    }).catch(() => generatePuzzle(level));
  }

  private load(p: Puzzle) {
    this.puzzle.set(p);
    this.placements.set(p.characters.map(() => null));
    this.marks.set(new Set());
    this.crossed.set(new Set());
    this.tool.set(null);
    this.elapsed.set(0);
    this.solved.set(false);
    this.errors.set(new Set());
    this.history = [];
    this.canUndo.set(false);
    this.save();
  }

  leave() {
    if (this.solved()) {
      try {
        localStorage.removeItem(SAVE_KEY);
      } catch {}
    } else {
      this.save();
    }
    this.puzzle.set(null);
  }

  private snapshot() {
    this.history.push({ placements: this.placements(), marks: [...this.marks()] });
    if (this.history.length > 200) this.history.shift();
    this.canUndo.set(true);
  }

  undo() {
    const s = this.history.pop();
    if (!s) return;
    this.placements.set(s.placements);
    this.marks.set(new Set(s.marks));
    this.canUndo.set(this.history.length > 0);
    this.solved.set(false);
    this.save();
  }

  selectTool(t: Tool) {
    this.tool.update((cur) => (cur === t ? null : t));
  }

  isBlocked(r: number, c: number): boolean {
    return !!this.puzzle()?.board.objects[r][c];
  }

  charAt(r: number, c: number): number {
    return this.placements().findIndex((p) => p && p.r === r && p.c === c);
  }

  tapCell(r: number, c: number) {
    const p = this.puzzle();
    if (!p || this.solved() || this.isBlocked(r, c)) return;
    const tool = this.tool();
    const occupant = this.charAt(r, c);
    const key = `${r},${c}`;

    if (tool === 'mark') {
      if (occupant >= 0) return;
      this.snapshot();
      const m = new Set(this.marks());
      m.has(key) ? m.delete(key) : m.add(key);
      this.marks.set(m);
    } else if (typeof tool === 'number') {
      this.snapshot();
      const pl = [...this.placements()];
      if (occupant === tool) {
        pl[tool] = null;
      } else {
        if (occupant >= 0) pl[occupant] = null;
        const wasPlaced = !!pl[tool];
        pl[tool] = { r, c };
        const m = new Set(this.marks());
        m.delete(key);
        this.marks.set(m);
        // Passe au prochain personnage non placé (sauf si on vient de déplacer un personnage).
        const next = wasPlaced ? -1 : pl.findIndex((x) => !x);
        this.tool.set(next >= 0 ? next : null);
      }
      this.placements.set(pl);
    } else if (occupant >= 0) {
      this.tool.set(occupant);
    }
    this.errors.set(new Set());
    this.checkSolved();
    this.save();
  }

  /** Clic droit / appui long : barre une case vide, ou retire le personnage qui s'y trouve. */
  secondaryAction(r: number, c: number) {
    if (!this.puzzle() || this.solved() || this.isBlocked(r, c)) return;
    const occupant = this.charAt(r, c);
    if (occupant >= 0) {
      this.removeChar(occupant);
      return;
    }
    this.snapshot();
    const key = `${r},${c}`;
    const m = new Set(this.marks());
    m.has(key) ? m.delete(key) : m.add(key);
    this.marks.set(m);
    this.errors.set(new Set());
    this.save();
  }

  removeChar(id: number) {
    if (!this.placements()[id] || this.solved()) return;
    this.snapshot();
    const pl = [...this.placements()];
    pl[id] = null;
    this.placements.set(pl);
    this.save();
  }

  toggleClue(i: number) {
    const s = new Set(this.crossed());
    s.has(i) ? s.delete(i) : s.add(i);
    this.crossed.set(s);
    this.save();
  }

  /** Surligne brièvement les personnages mal placés. */
  check() {
    const p = this.puzzle();
    if (!p) return;
    const bad = new Set<number>();
    this.placements().forEach((pos, i) => {
      if (pos && (pos.r !== p.solution[i].r || pos.c !== p.solution[i].c)) bad.add(i);
    });
    this.errors.set(bad);
    clearTimeout(this.errorTimer);
    this.errorTimer = setTimeout(() => this.errors.set(new Set()), 3000);
  }

  hint() {
    const p = this.puzzle();
    if (!p || this.solved()) return;
    const pl = [...this.placements()];
    const wrong = pl.findIndex((pos, i) => pos && (pos.r !== p.solution[i].r || pos.c !== p.solution[i].c));
    const target = wrong >= 0 ? wrong : pl.findIndex((x) => !x);
    if (target < 0) return;
    this.snapshot();
    const sol = p.solution[target];
    const occ = this.charAt(sol.r, sol.c);
    if (occ >= 0) pl[occ] = null;
    pl[target] = { ...sol };
    this.placements.set(pl);
    this.elapsed.update((e) => e + 30);
    this.checkSolved();
    this.save();
  }

  private checkSolved() {
    const p = this.puzzle();
    if (!p) return;
    const ok = this.placements().every((pos, i) => pos && pos.r === p.solution[i].r && pos.c === p.solution[i].c);
    if (ok && !this.solved()) {
      this.solved.set(true);
      this.tool.set(null);
      const b = { ...this.best() };
      if (!b[p.level] || this.elapsed() < b[p.level]) b[p.level] = this.elapsed();
      this.best.set(b);
      try {
        localStorage.setItem(BEST_KEY, JSON.stringify(b));
      } catch {}
    }
  }

  private readBest(): Record<number, number> {
    try {
      return JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}');
    } catch {
      return {};
    }
  }

  private save() {
    const p = this.puzzle();
    if (!p) return;
    const data: SaveData = {
      puzzle: p,
      placements: this.placements(),
      marks: [...this.marks()],
      crossed: [...this.crossed()],
      elapsed: this.elapsed(),
      solved: this.solved(),
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {}
  }
}
