import type { CardId, SuspectId } from '../src/domain/cards';
import type {
  Game,
  GameEvent,
  GamePlayer,
  Settings,
  SuggestionCards,
} from '../src/domain/types';
import { defaultBoardSettings } from '../src/domain/board';

export const TEST_SETTINGS: Settings = {
  ...defaultBoardSettings(),
  sampleTarget: 1500,
  sampleMaxAttempts: 30000,
};

let evCounter = 0;

export function makePlayers(
  defs: { id: string; handSize: number; self?: boolean; suspect?: SuspectId }[],
): GamePlayer[] {
  const suspects: SuspectId[] = ['scarlett', 'mustard', 'white', 'green', 'peacock', 'plum'];
  return defs.map((d, i) => ({
    id: d.id,
    name: d.id.toUpperCase(),
    color: '#888888',
    suspect: d.suspect ?? suspects[i],
    handSize: d.handSize,
    isSelf: !!d.self,
    eliminated: false,
  }));
}

export function makeGame(opts: {
  players: GamePlayer[];
  potCards?: CardId[];
  yourHand?: CardId[];
  events?: GameEvent[];
}): Game {
  return {
    id: 'test-game',
    createdAt: Date.now(),
    status: 'in_progress',
    players: opts.players,
    potSize: (opts.potCards ?? []).length,
    potCards: opts.potCards ?? [],
    yourHand: opts.yourHand ?? [],
    events: opts.events ?? [],
    cursor: { turn: 1, seatIndex: 0 },
    solution: {},
    rev: 1,
  };
}

export function suggestion(
  suggesterId: string,
  cards: SuggestionCards,
  outcome:
    | { kind: 'disproved'; byId: string; shownCard?: CardId }
    | { kind: 'none' },
): GameEvent {
  evCounter++;
  return {
    type: 'suggestion',
    id: `ev-${evCounter}`,
    at: Date.now(),
    turn: evCounter,
    cursorBefore: { turn: evCounter, seatIndex: 0 },
    suggesterId,
    cards,
    outcome,
  };
}

export function accusation(
  accuserId: string,
  cards: SuggestionCards,
  success: boolean,
): GameEvent {
  evCounter++;
  return {
    type: 'accusation',
    id: `ev-${evCounter}`,
    at: Date.now(),
    turn: evCounter,
    cursorBefore: { turn: evCounter, seatIndex: 0 },
    accuserId,
    cards,
    success,
  };
}
