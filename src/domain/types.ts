import type { CardId, RoomId, SuspectId, WeaponId, Category } from './cards';
import type { BoardSettings } from './board';

/** Special holders alongside the players. */
export const ENVELOPE = 'ENVELOPE';
export const POT = 'POT';
export type HolderId = string; // player id (roster id), ENVELOPE, or POT

export type Mark = 'has' | 'hasNot' | 'unknown';
export type Marks = Record<CardId, Record<HolderId, Mark>>;

export type ArrivalReason = 'self' | 'secret_passage' | 'summoned';

export type Location =
  | { kind: 'room'; room: RoomId }
  | { kind: 'hallway' };

export interface LocationState {
  location: Location;
  arrival: ArrivalReason;
  /** True once they enter a room, false after they use a suggestion there. */
  eligibleToSuggest: boolean;
}

export interface RosterPlayer {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

export interface GamePlayer {
  /** Same as the roster id; unique within a game. */
  id: string;
  name: string;
  color: string;
  suspect: SuspectId | null;
  handSize: number;
  isSelf: boolean;
  eliminated: boolean;
}

export interface SuggestionCards {
  suspect: SuspectId;
  weapon: WeaponId;
  room: RoomId;
}

export interface TurnCursor {
  turn: number;
  seatIndex: number;
}

export type GameEvent =
  | {
      type: 'suggestion';
      id: string;
      at: number;
      turn: number;
      cursorBefore: TurnCursor;
      suggesterId: string;
      cards: SuggestionCards;
      outcome:
        | { kind: 'disproved'; byId: string; shownCard?: CardId }
        | { kind: 'none' };
    }
  | {
      type: 'accusation';
      id: string;
      at: number;
      turn: number;
      cursorBefore: TurnCursor;
      accuserId: string;
      cards: SuggestionCards;
      success: boolean;
    }
  | {
      type: 'movement';
      id: string;
      at: number;
      turn: number;
      cursorBefore: TurnCursor;
      playerId: string;
      to: Location;
      arrival: ArrivalReason;
    };

export type GameStatus = 'setup' | 'in_progress' | 'completed' | 'abandoned';

export interface Game {
  id: string;
  createdAt: number;
  endedAt?: number;
  status: GameStatus;
  /** Participants in seating order. */
  players: GamePlayer[];
  potSize: number;
  potCards: CardId[];
  /** True once the user manually edits hand/pot sizes; stops auto re-dealing. */
  dealTouched?: boolean;
  /** Your dealt hand (the self player's cards). */
  yourHand: CardId[];
  events: GameEvent[];
  cursor: TurnCursor;
  winnerId?: string;
  /** Discovered solution, filled as proven (grid or successful accusation). */
  solution: Partial<Record<Category, CardId>>;
  /** Bumped on every mutation; used as a memo/sampler seed key. */
  rev: number;
}

export interface Settings extends BoardSettings {
  /** Monte Carlo tuning. */
  sampleTarget: number;
  sampleMaxAttempts: number;
}

export interface Disjunction {
  id: string;
  holder: HolderId;
  cards: CardId[];
}

export interface DisjunctionState extends Disjunction {
  /** Cards still possible for this holder. */
  remaining: CardId[];
  /** Set when the disjunction has forced or been satisfied by a known card. */
  satisfiedBy?: CardId;
}

export interface Recommendation {
  room: RoomId;
  suspect: SuspectId;
  weapon: WeaponId;
  reach: number;
  viaSecretPassage: boolean;
  /** Expected entropy reduction (nats) over the envelope distribution. */
  info: number;
  score: number;
  note: string;
}
