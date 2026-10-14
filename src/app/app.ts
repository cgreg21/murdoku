import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { GameService } from './game.service';
import { clueText, colLabel } from './engine/clue-text';
import { LEVELS, OBJECT_KINDS, ROOM_COLORS } from './engine/types';

interface CellVm {
  r: number;
  c: number;
  color: string;
  obj: string | null;
  charId: number;
  mark: boolean;
  conflict: boolean;
  error: boolean;
  wallTop: boolean;
  wallRight: boolean;
  wallBottom: boolean;
  wallLeft: boolean;
  label: string | null;
  decos: { kind: 'door' | 'window'; side: string }[];
}

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly game = inject(GameService);
  protected readonly levels = LEVELS;
  protected readonly colLabel = colLabel;
  protected readonly showHelp = signal(false);
  protected readonly canResume = signal(this.game.hasSave());

  protected readonly cells = computed<CellVm[]>(() => {
    const p = this.game.puzzle();
    if (!p) return [];
    const b = p.board;
    const pl = this.game.placements();
    const marks = this.game.marks();
    const conflicts = this.game.conflicts();
    const errors = this.game.errors();
    const flat = b.rooms.flat();
    const decos = new Map<string, { kind: 'door' | 'window'; side: string }[]>();
    const addDeco = (list: string[] | undefined, kind: 'door' | 'window') => {
      for (const k of list ?? []) {
        const [r, c, side] = k.split(',');
        const key = `${r},${c}`;
        decos.set(key, [...(decos.get(key) ?? []), { kind, side }]);
      }
    };
    addDeco(b.doors, 'door');
    addDeco(b.windows, 'window');
    const out: CellVm[] = [];
    for (let r = 0; r < b.size; r++)
      for (let c = 0; c < b.size; c++) {
        const room = b.rooms[r][c];
        const charId = pl.findIndex((x) => x && x.r === r && x.c === c);
        const obj = b.objects[r][c];
        // Le nom de la pièce s'affiche sur sa première case.
        const first = flat.indexOf(room) === r * b.size + c;
        out.push({
          r,
          c,
          color: ROOM_COLORS[room % ROOM_COLORS.length],
          obj: obj ? OBJECT_KINDS.find((k) => k.id === obj)!.emoji : null,
          charId,
          mark: marks.has(`${r},${c}`),
          conflict: charId >= 0 && conflicts.has(charId),
          error: charId >= 0 && errors.has(charId),
          wallTop: b.rooms[r - 1]?.[c] !== room,
          wallBottom: b.rooms[r + 1]?.[c] !== room,
          wallLeft: b.rooms[r]?.[c - 1] !== room,
          wallRight: b.rooms[r]?.[c + 1] !== room,
          label: first ? b.roomNames[room] : null,
          decos: decos.get(`${r},${c}`) ?? [],
        });
      }
    return out;
  });

  protected readonly clues = computed(() => {
    const p = this.game.puzzle();
    return p ? p.clues.map((c) => clueText(p, c)) : [];
  });

  protected readonly rows = computed(() => {
    const n = this.game.puzzle()?.board.size ?? 0;
    return Array.from({ length: n }, (_, i) => i);
  });

  protected readonly levelName = computed(() => {
    const p = this.game.puzzle();
    return p ? LEVELS[p.level - 1].name : '';
  });

  protected readonly killerName = computed(() => {
    const p = this.game.puzzle();
    return p ? p.characters[p.killer].name : '';
  });

  protected time(s: number): string {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  protected start(level: number) {
    this.game.newGame(level);
  }

  protected resume() {
    this.game.resume();
  }

  protected tokenOf(id: number) {
    return this.game.puzzle()!.characters[id];
  }

  private pressTimer?: ReturnType<typeof setTimeout>;
  private longPressed = false;

  /** Appui long tactile = action secondaire (le menu contextuel natif n'existe pas partout). */
  protected pressStart(e: PointerEvent, r: number, c: number) {
    this.longPressed = false;
    if (e.pointerType === 'mouse') return;
    this.pressEnd();
    this.pressTimer = setTimeout(() => {
      this.longPressed = true;
      this.game.secondaryAction(r, c);
      navigator.vibrate?.(20);
    }, 450);
  }

  protected pressEnd() {
    clearTimeout(this.pressTimer);
  }

  protected onTap(e: Event, r: number, c: number) {
    if (this.longPressed) {
      this.longPressed = false;
      e.preventDefault();
      return;
    }
    this.game.tapCell(r, c);
  }

  protected onSecondary(e: Event, r: number, c: number) {
    e.preventDefault();
    if (this.longPressed) return; // déjà traité par l'appui long
    this.game.secondaryAction(r, c);
  }

  protected rowCells(r: number) {
    const n = this.rows().length;
    return this.cells().slice(r * n, (r + 1) * n);
  }
}
