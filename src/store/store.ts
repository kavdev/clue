/**
 * App store: roster, games, settings, and every game action.
 * State persists to localStorage through the storage module; derived solver
 * state is recomputed from the event log (see domain/derive).
 */

import { create } from 'zustand';
import type { CardId, RoomId, SuspectId } from '../domain/cards';
import { defaultBoardSettings } from '../domain/board';
import type {
  ArrivalReason,
  Game,
  GameEvent,
  GamePlayer,
  Location,
  RosterPlayer,
  Settings,
  SuggestionCards,
} from '../domain/types';
import { extractFacts } from '../domain/derive';
import { defaultDeal } from '../domain/validate';
import { load, save } from './storage';

export const ROSTER_COLORS = [
  '#b3553a', '#3a6ea5', '#3f7d4e', '#7d5295', '#c08a2d', '#2a7f7f',
  '#9d4564', '#5b6e2f', '#8a623f', '#4f5d75', '#a13c3c', '#3d7068',
];

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function defaultSettings(): Settings {
  return { ...defaultBoardSettings(), sampleTarget: 2500, sampleMaxAttempts: 30000 };
}

/** Merge stored settings over defaults so new fields appear after upgrades. */
function loadSettings(): Settings {
  const d = defaultSettings();
  const stored = load<Partial<Settings>>('settings', {});
  return {
    ...d,
    ...stored,
    tierSteps: { ...d.tierSteps, ...(stored.tierSteps ?? {}) },
    matrix: stored.matrix ?? d.matrix,
  };
}

export interface ClueState {
  roster: RosterPlayer[];
  games: Game[];
  settings: Settings;

  addRosterPlayer: (name: string) => RosterPlayer;
  renameRosterPlayer: (id: string, name: string) => void;

  createGame: () => string;
  deleteGame: (id: string) => void;
  abandonGame: (id: string) => void;

  // Setup actions
  setGamePlayers: (gameId: string, rosterIds: string[]) => void;
  moveSeat: (gameId: string, playerId: string, dir: -1 | 1) => void;
  setSelf: (gameId: string, playerId: string) => void;
  setSuspect: (gameId: string, playerId: string, suspect: SuspectId | null) => void;
  setHandSize: (gameId: string, playerId: string, size: number) => void;
  setPotSize: (gameId: string, size: number) => void;
  resetDeal: (gameId: string) => void;
  togglePotCard: (gameId: string, card: CardId) => void;
  toggleHandCard: (gameId: string, card: CardId) => void;
  startGame: (gameId: string) => void;

  // Live actions
  logSuggestion: (
    gameId: string,
    payload: {
      suggesterId: string;
      cards: SuggestionCards;
      outcome: { kind: 'disproved'; byId: string; shownCard?: CardId } | { kind: 'none' };
    },
  ) => void;
  logAccusation: (
    gameId: string,
    payload: { accuserId: string; cards: SuggestionCards; success: boolean },
  ) => void;
  logMovement: (
    gameId: string,
    payload: { playerId: string; to: Location; arrival: ArrivalReason },
  ) => void;
  undoLast: (gameId: string) => void;
  nextTurn: (gameId: string) => void;
  prevTurn: (gameId: string) => void;

  updateSettings: (patch: Partial<Settings>) => void;
  setMatrixTier: (a: RoomId, b: RoomId, tier: 'near' | 'mid' | 'far') => void;
}

function persist(state: Pick<ClueState, 'roster' | 'games' | 'settings'>) {
  save('roster', state.roster);
  save('games', state.games);
  save('settings', state.settings);
}

/** Next non-eliminated seat after `from` (wrapping). Falls back to `from`. */
function nextActiveSeat(game: Game, from: number): number {
  const n = game.players.length;
  const facts = extractFacts(game);
  for (let k = 1; k <= n; k++) {
    const idx = (from + k) % n;
    if (!facts.eliminated[game.players[idx].id]) return idx;
  }
  return from;
}

/** Sync convenience fields (eliminated flags, discovered solution) from the event log. */
function syncDerived(game: Game): Game {
  const facts = extractFacts(game);
  game.players = game.players.map((p) => ({ ...p, eliminated: !!facts.eliminated[p.id] }));
  if (facts.confirmedSolution) {
    game.solution = { ...facts.confirmedSolution };
    game.winnerId = facts.winnerId;
  }
  return game;
}

export const useStore = create<ClueState>((set, get) => {
  const update = (fn: (s: ClueState) => Partial<ClueState>) => {
    set((s) => {
      const patch = fn(s);
      const next = { ...s, ...patch };
      persist(next);
      return patch;
    });
  };

  const updateGame = (id: string, mut: (g: Game) => Game | null) => {
    update((s) => ({
      games: s.games.map((g) => {
        if (g.id !== id) return g;
        const draft = structuredClone(g);
        const out = mut(draft);
        if (out === null) return g;
        out.rev = (g.rev ?? 0) + 1;
        return out;
      }),
    }));
  };

  const appendEvent = (game: Game, ev: GameEvent) => {
    game.events.push(ev);
  };

  return {
    roster: load<RosterPlayer[]>('roster', []),
    games: load<Game[]>('games', []),
    settings: loadSettings(),

    addRosterPlayer: (name) => {
      const trimmed = name.trim();
      const existing = get().roster.find(
        (p) => p.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (existing) return existing;
      const used = new Set(get().roster.map((p) => p.color));
      const color = ROSTER_COLORS.find((c) => !used.has(c)) ??
        ROSTER_COLORS[get().roster.length % ROSTER_COLORS.length];
      const player: RosterPlayer = { id: uid(), name: trimmed, color, createdAt: Date.now() };
      update((s) => ({ roster: [...s.roster, player] }));
      return player;
    },

    renameRosterPlayer: (id, name) => {
      update((s) => ({
        roster: s.roster.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p)),
        games: s.games.map((g) => ({
          ...g,
          players: g.players.map((pl) =>
            pl.id === id ? { ...pl, name: name.trim() || pl.name } : pl,
          ),
        })),
      }));
    },

    createGame: () => {
      const id = uid();
      const game: Game = {
        id,
        createdAt: Date.now(),
        status: 'setup',
        players: [],
        potSize: 0,
        potCards: [],
        yourHand: [],
        events: [],
        cursor: { turn: 1, seatIndex: 0 },
        solution: {},
        rev: 0,
      };
      update((s) => ({ games: [...s.games, game] }));
      return id;
    },

    deleteGame: (id) => {
      update((s) => ({ games: s.games.filter((g) => g.id !== id) }));
    },

    abandonGame: (id) => {
      updateGame(id, (g) => {
        g.status = 'abandoned';
        g.endedAt = Date.now();
        return g;
      });
    },

    setGamePlayers: (gameId, rosterIds) => {
      const roster = get().roster;
      updateGame(gameId, (g) => {
        const prev = new Map(g.players.map((p) => [p.id, p]));
        g.players = rosterIds.map((rid) => {
          const existing = prev.get(rid);
          if (existing) return existing;
          const r = roster.find((p) => p.id === rid)!;
          const player: GamePlayer = {
            id: r.id,
            name: r.name,
            color: r.color,
            suspect: null,
            handSize: 0,
            isSelf: false,
            eliminated: false,
          };
          return player;
        });
        // Keep the deal sensible as the table changes, unless manually edited.
        const sum = g.players.reduce((a, p) => a + p.handSize, 0) + g.potSize + 3;
        if (!g.dealTouched || sum !== 21) {
          const deal = defaultDeal(g.players.length);
          g.players = g.players.map((p) => ({ ...p, handSize: deal.handSize }));
          g.potSize = deal.potSize;
          g.potCards = g.potCards.slice(0, deal.potSize);
        }
        return g;
      });
    },

    moveSeat: (gameId, playerId, dir) => {
      updateGame(gameId, (g) => {
        const i = g.players.findIndex((p) => p.id === playerId);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= g.players.length) return null;
        [g.players[i], g.players[j]] = [g.players[j], g.players[i]];
        return g;
      });
    },

    setSelf: (gameId, playerId) => {
      updateGame(gameId, (g) => {
        g.players = g.players.map((p) => ({ ...p, isSelf: p.id === playerId }));
        return g;
      });
    },

    setSuspect: (gameId, playerId, suspect) => {
      updateGame(gameId, (g) => {
        g.players = g.players.map((p) => {
          if (p.id === playerId) return { ...p, suspect };
          // Tapping a suspect steals it from whoever had it.
          if (suspect && p.suspect === suspect) return { ...p, suspect: null };
          return p;
        });
        return g;
      });
    },

    setHandSize: (gameId, playerId, size) => {
      updateGame(gameId, (g) => {
        g.dealTouched = true;
        g.players = g.players.map((p) =>
          p.id === playerId ? { ...p, handSize: Math.max(0, Math.min(18, size)) } : p,
        );
        return g;
      });
    },

    setPotSize: (gameId, size) => {
      updateGame(gameId, (g) => {
        g.dealTouched = true;
        g.potSize = Math.max(0, Math.min(18, size));
        return g;
      });
    },

    resetDeal: (gameId) => {
      updateGame(gameId, (g) => {
        const deal = defaultDeal(g.players.length);
        g.dealTouched = false;
        g.players = g.players.map((p) => ({ ...p, handSize: deal.handSize }));
        g.potSize = deal.potSize;
        g.potCards = g.potCards.slice(0, deal.potSize);
        return g;
      });
    },

    togglePotCard: (gameId, card) => {
      updateGame(gameId, (g) => {
        if (g.potCards.includes(card)) {
          g.potCards = g.potCards.filter((c) => c !== card);
        } else {
          g.potCards = [...g.potCards, card];
          g.yourHand = g.yourHand.filter((c) => c !== card);
        }
        return g;
      });
    },

    toggleHandCard: (gameId, card) => {
      updateGame(gameId, (g) => {
        if (g.yourHand.includes(card)) {
          g.yourHand = g.yourHand.filter((c) => c !== card);
        } else {
          g.yourHand = [...g.yourHand, card];
          g.potCards = g.potCards.filter((c) => c !== card);
        }
        return g;
      });
    },

    startGame: (gameId) => {
      updateGame(gameId, (g) => {
        g.status = 'in_progress';
        // Tradition: Miss Scarlett's player opens; otherwise seat 1.
        const scarlettSeat = g.players.findIndex((p) => p.suspect === 'scarlett');
        g.cursor = { turn: 1, seatIndex: scarlettSeat >= 0 ? scarlettSeat : 0 };
        return g;
      });
    },

    logSuggestion: (gameId, payload) => {
      updateGame(gameId, (g) => {
        // Turns advance only via the turn stepper: a player may still
        // accuse after suggesting, so logging must not end the turn.
        appendEvent(g, {
          type: 'suggestion',
          id: uid(),
          at: Date.now(),
          turn: g.cursor.turn,
          cursorBefore: { ...g.cursor },
          ...payload,
        });
        return syncDerived(g);
      });
    },

    logAccusation: (gameId, payload) => {
      updateGame(gameId, (g) => {
        appendEvent(g, {
          type: 'accusation',
          id: uid(),
          at: Date.now(),
          turn: g.cursor.turn,
          cursorBefore: { ...g.cursor },
          ...payload,
        });
        if (payload.success) {
          g.status = 'completed';
          g.winnerId = payload.accuserId;
          g.endedAt = Date.now();
          g.solution = { ...payload.cards };
        }
        return syncDerived(g);
      });
    },

    logMovement: (gameId, payload) => {
      updateGame(gameId, (g) => {
        appendEvent(g, {
          type: 'movement',
          id: uid(),
          at: Date.now(),
          turn: g.cursor.turn,
          cursorBefore: { ...g.cursor },
          ...payload,
        });
        return syncDerived(g);
      });
    },

    undoLast: (gameId) => {
      updateGame(gameId, (g) => {
        const last = g.events.pop();
        if (!last) return null;
        g.cursor = { ...last.cursorBefore };
        if (last.type === 'accusation' && last.success) {
          g.status = 'in_progress';
          g.winnerId = undefined;
          g.endedAt = undefined;
          g.solution = {};
        }
        return syncDerived(g);
      });
    },

    nextTurn: (gameId) => {
      updateGame(gameId, (g) => {
        g.cursor = {
          turn: g.cursor.turn + 1,
          seatIndex: nextActiveSeat(g, g.cursor.seatIndex),
        };
        return g;
      });
    },

    prevTurn: (gameId) => {
      updateGame(gameId, (g) => {
        const n = g.players.length;
        const facts = extractFacts(g);
        let idx = g.cursor.seatIndex;
        for (let k = 1; k <= n; k++) {
          const cand = (idx - k + n * 2) % n;
          if (!facts.eliminated[g.players[cand].id]) {
            idx = cand;
            break;
          }
        }
        g.cursor = { turn: Math.max(1, g.cursor.turn - 1), seatIndex: idx };
        return g;
      });
    },

    updateSettings: (patch) => {
      update((s) => ({ settings: { ...s.settings, ...patch } }));
    },

    setMatrixTier: (a, b, tier) => {
      update((s) => {
        const matrix = structuredClone(s.settings.matrix);
        matrix[a][b] = tier;
        matrix[b][a] = tier;
        return { settings: { ...s.settings, matrix } };
      });
    },
  };
});

export function getGame(state: ClueState, id: string | undefined): Game | undefined {
  return state.games.find((g) => g.id === id);
}
