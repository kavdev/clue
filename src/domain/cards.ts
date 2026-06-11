/**
 * The 21 cards of the 1998 Parker Brothers "Classic Detective Game" edition.
 */

export type Category = 'suspect' | 'weapon' | 'room';

export type SuspectId =
  | 'scarlett'
  | 'mustard'
  | 'white'
  | 'green'
  | 'peacock'
  | 'plum';

export type WeaponId =
  | 'candlestick'
  | 'dagger'
  | 'leadpipe'
  | 'revolver'
  | 'rope'
  | 'wrench';

export type RoomId =
  | 'kitchen'
  | 'ballroom'
  | 'conservatory'
  | 'dining'
  | 'billiard'
  | 'library'
  | 'lounge'
  | 'hall'
  | 'study';

export type CardId = SuspectId | WeaponId | RoomId;

export interface CardDef {
  id: CardId;
  name: string;
  short: string;
  category: Category;
}

export const SUSPECTS: CardDef[] = [
  { id: 'scarlett', name: 'Miss Scarlett', short: 'Scarlett', category: 'suspect' },
  { id: 'mustard', name: 'Colonel Mustard', short: 'Mustard', category: 'suspect' },
  { id: 'white', name: 'Mrs. White', short: 'White', category: 'suspect' },
  { id: 'green', name: 'Reverend Green', short: 'Green', category: 'suspect' },
  { id: 'peacock', name: 'Mrs. Peacock', short: 'Peacock', category: 'suspect' },
  { id: 'plum', name: 'Professor Plum', short: 'Plum', category: 'suspect' },
];

export const WEAPONS: CardDef[] = [
  { id: 'candlestick', name: 'Candlestick', short: 'Candlestick', category: 'weapon' },
  { id: 'dagger', name: 'Dagger', short: 'Dagger', category: 'weapon' },
  { id: 'leadpipe', name: 'Lead Pipe', short: 'Lead Pipe', category: 'weapon' },
  { id: 'revolver', name: 'Revolver', short: 'Revolver', category: 'weapon' },
  { id: 'rope', name: 'Rope', short: 'Rope', category: 'weapon' },
  { id: 'wrench', name: 'Wrench', short: 'Wrench', category: 'weapon' },
];

export const ROOM_CARDS: CardDef[] = [
  { id: 'kitchen', name: 'Kitchen', short: 'Kitchen', category: 'room' },
  { id: 'ballroom', name: 'Ballroom', short: 'Ballroom', category: 'room' },
  { id: 'conservatory', name: 'Conservatory', short: 'Conserv.', category: 'room' },
  { id: 'dining', name: 'Dining Room', short: 'Dining', category: 'room' },
  { id: 'billiard', name: 'Billiard Room', short: 'Billiard', category: 'room' },
  { id: 'library', name: 'Library', short: 'Library', category: 'room' },
  { id: 'lounge', name: 'Lounge', short: 'Lounge', category: 'room' },
  { id: 'hall', name: 'Hall', short: 'Hall', category: 'room' },
  { id: 'study', name: 'Study', short: 'Study', category: 'room' },
];

export const ALL_CARDS: CardDef[] = [...SUSPECTS, ...WEAPONS, ...ROOM_CARDS];

export const CARD_BY_ID: Record<CardId, CardDef> = Object.fromEntries(
  ALL_CARDS.map((c) => [c.id, c]),
) as Record<CardId, CardDef>;

export const CATEGORIES: Category[] = ['suspect', 'weapon', 'room'];

export const CARDS_BY_CATEGORY: Record<Category, CardDef[]> = {
  suspect: SUSPECTS,
  weapon: WEAPONS,
  room: ROOM_CARDS,
};

export const ROOM_IDS: RoomId[] = ROOM_CARDS.map((c) => c.id as RoomId);

/** Index of every card in ALL_CARDS order — used by the sampler's compact deals. */
export const CARD_INDEX: Record<CardId, number> = Object.fromEntries(
  ALL_CARDS.map((c, i) => [c.id, i]),
) as Record<CardId, number>;

export function cardName(id: CardId): string {
  return CARD_BY_ID[id].name;
}

/** Canonical token colors for the six suspects (board flavor, not roster identity). */
export const SUSPECT_COLORS: Record<SuspectId, string> = {
  scarlett: '#b3242a',
  mustard: '#c9a227',
  white: '#e8e4d8',
  green: '#1e7d46',
  peacock: '#1f5673',
  plum: '#6c3483',
};
