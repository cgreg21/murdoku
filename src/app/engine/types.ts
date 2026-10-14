export interface Character {
  id: number;
  name: string;
  emoji: string;
  color: string;
}

export interface ObjectKind {
  id: string;
  emoji: string;
  label: string; // avec article indéfini, ex. "une plante"
}

export interface Pos {
  r: number;
  c: number;
}

export type Clue =
  | { t: 'room'; a: number; room: number; neg: boolean }
  | { t: 'row'; a: number; row: number }
  | { t: 'col'; a: number; col: number }
  | { t: 'adj'; a: number; b: number; neg: boolean }
  | { t: 'same'; a: number; b: number; neg: boolean }
  | { t: 'left'; a: number; b: number }
  | { t: 'above'; a: number; b: number }
  | { t: 'alone'; a: number }
  | { t: 'near'; a: number; kind: string }
  | { t: 'edge'; a: number; kind: 'door' | 'window' };

export interface Board {
  size: number;
  rooms: number[][]; // identifiant de pièce par case
  roomNames: string[];
  objects: (string | null)[][]; // identifiant d'objet (case bloquée) ou null
  // Ouvertures "r,c,côté" (t/r/b/l). Les portes ne sont stockées que côté r ou b.
  doors: string[];
  windows: string[];
  doorCells: boolean[][]; // la case touche une porte
  windowCells: boolean[][]; // la case touche une fenêtre
}

export interface Puzzle {
  seed: number;
  level: number;
  board: Board;
  characters: Character[];
  victim: number;
  killer: number;
  clues: Clue[];
  solution: Pos[]; // position de chaque personnage (index = id)
}

export const CHARACTERS: Character[] = [
  { id: 0, name: 'Rose', emoji: '👩', color: '#e8618c' },
  { id: 1, name: 'Olive', emoji: '🧑‍🌾', color: '#7a9a2e' },
  { id: 2, name: 'Azur', emoji: '👨‍✈️', color: '#3b82d6' },
  { id: 3, name: 'Violette', emoji: '👵', color: '#8e5bd0' },
  { id: 4, name: 'Orangine', emoji: '👩‍🍳', color: '#f08a24' },
  { id: 5, name: 'Perle', emoji: '🧓', color: '#8d9aa6' },
  { id: 6, name: 'Marron', emoji: '🕵️', color: '#8b5a3c' },
  { id: 7, name: 'Citron', emoji: '👨‍🎨', color: '#d4b400' },
  { id: 8, name: 'Jade', emoji: '👩‍⚕️', color: '#1fa080' },
];

export const OBJECT_KINDS: ObjectKind[] = [
  { id: 'plant', emoji: '🪴', label: 'une plante' },
  { id: 'sofa', emoji: '🛋️', label: 'un canapé' },
  { id: 'table', emoji: '🪑', label: 'une chaise' },
  { id: 'bed', emoji: '🛏️', label: 'un lit' },
  { id: 'piano', emoji: '🎹', label: 'un piano' },
  { id: 'books', emoji: '📚', label: 'des livres' },
  { id: 'tv', emoji: '📺', label: 'une télévision' },
  { id: 'fridge', emoji: '🧊', label: 'un frigo' },
];

export const ROOM_NAMES = [
  'Cuisine',
  'Salon',
  'Bibliothèque',
  'Bureau',
  'Chambre',
  'Véranda',
  'Cave',
  'Garage',
  'Salle de bain',
];

export const ROOM_COLORS = ['#f6d8a8', '#bfe3c0', '#c4d6f2', '#f2c4d0', '#e0cdf0', '#f4f0a8', '#c8e6e6', '#e6d2c0', '#d6dcb0'];

export interface LevelConfig {
  level: number;
  name: string;
  size: number;
  rooms: number;
  objects: number;
  clueTypes: Clue['t'][];
  allowNegative: boolean;
  pruneRatio: number; // part des indices redondants supprimés
}

export const LEVELS: LevelConfig[] = [
  { level: 1, name: 'Débutant', size: 5, rooms: 3, objects: 3, clueTypes: ['room', 'near', 'adj', 'left', 'above'], allowNegative: false, pruneRatio: 0.2 },
  { level: 2, name: 'Facile', size: 6, rooms: 4, objects: 4, clueTypes: ['room', 'near', 'edge', 'adj', 'same', 'left', 'above', 'alone'], allowNegative: false, pruneRatio: 0.5 },
  { level: 3, name: 'Moyen', size: 7, rooms: 4, objects: 6, clueTypes: ['room', 'near', 'edge', 'adj', 'same', 'left', 'above', 'alone'], allowNegative: true, pruneRatio: 0.8 },
  { level: 4, name: 'Difficile', size: 8, rooms: 5, objects: 8, clueTypes: ['room', 'near', 'edge', 'adj', 'same', 'left', 'above', 'alone'], allowNegative: true, pruneRatio: 1 },
  { level: 5, name: 'Expert', size: 9, rooms: 6, objects: 10, clueTypes: ['room', 'near', 'edge', 'adj', 'same', 'left', 'above', 'alone'], allowNegative: true, pruneRatio: 1 },
];

