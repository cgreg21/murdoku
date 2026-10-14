import { Clue, OBJECT_KINDS, Puzzle } from './types';

export function colLabel(c: number): string {
  return String.fromCharCode(65 + c);
}

export function clueText(p: Puzzle, clue: Clue): string {
  const name = (i: number) => p.characters[i].name;
  const a = name(clue.a);
  switch (clue.t) {
    case 'room':
      return `${a} ${clue.neg ? "n'est pas" : 'est'} dans la pièce « ${p.board.roomNames[clue.room]} ».`;
    case 'row':
      return `${a} est sur la ligne ${clue.row + 1}.`;
    case 'col':
      return `${a} est sur la colonne ${colLabel(clue.col)}.`;
    case 'near': {
      const kind = OBJECT_KINDS.find((k) => k.id === clue.kind)!;
      const de = kind.label.replace(/^une? /, (m) => `d'${m}`).replace(/^des /, 'des ');
      return `${a} est juste à côté ${de.startsWith("d'") || de.startsWith('des') ? '' : 'de '}${de} ${kind.emoji}.`;
    }
    case 'edge':
      return clue.kind === 'door' ? `${a} est juste à côté d'une porte 🚪.` : `${a} est contre une fenêtre 🪟.`;
    case 'adj':
      return `${a} ${clue.neg ? "n'est pas" : 'est'} juste à côté de ${name(clue.b)}.`;
    case 'same':
      return `${a} ${clue.neg ? "n'est pas" : 'est'} dans la même pièce que ${name(clue.b)}.`;
    case 'left':
      return `${a} est plus à gauche que ${name(clue.b)}.`;
    case 'above':
      return `${a} est plus haut que ${name(clue.b)}.`;
    case 'alone':
      return `${a} est seul(e) dans sa pièce.`;
  }
}
