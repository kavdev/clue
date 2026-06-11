/**
 * Turns a game's append-only event log into solver inputs and derived state:
 * facts, disjunctions, player locations, eliminations, and the full analysis
 * (Layer 1 + Layer 2 + recommendations). Everything here is recomputable from
 * the event log, so undo/load is just "re-derive".
 */

import type { CardId, RoomId } from './cards';
import { CATEGORIES, cardName } from './cards';
import type {
  Disjunction,
  Game,
  GameEvent,
  HolderId,
  LocationState,
  Recommendation,
  Settings,
  SuggestionCards,
} from './types';
import { solve, type SolverResult } from './solver';
import { sampleDeals, type SampleResult } from './sampler';
import { reachAll } from './board';
import { hashString, mulberry32 } from './rng';
import { recommendSuggestions } from './recommend';

export interface Analysis {
  solver: SolverResult;
  sample: SampleResult;
  locations: Record<string, LocationState>;
  eliminated: Record<string, boolean>;
  /** Proven solution per category (grid deduction or successful accusation). */
  solution: Partial<Record<'suspect' | 'weapon' | 'room', CardId>>;
  solvedAll: boolean;
  reach: Record<RoomId, number>;
  recommendations: Recommendation[];
  accuseNow?: SuggestionCards;
  contradictions: string[];
}

/** Players asked to disprove, in order, after the suggester (wrapping; suggester excluded). */
export function askOrder(playerIds: string[], suggesterId: string): string[] {
  const i = playerIds.indexOf(suggesterId);
  if (i < 0) return [];
  const out: string[] = [];
  for (let k = 1; k < playerIds.length; k++) {
    out.push(playerIds[(i + k) % playerIds.length]);
  }
  return out;
}

export interface ExtractedFacts {
  facts: { holder: HolderId; card: CardId; mark: 'has' | 'hasNot'; why?: string }[];
  disjunctions: Disjunction[];
  failedAccusations: SuggestionCards[];
  confirmedSolution?: SuggestionCards;
  locations: Record<string, LocationState>;
  eliminated: Record<string, boolean>;
  winnerId?: string;
}

export function extractFacts(game: Game): ExtractedFacts {
  const playerIds = game.players.map((p) => p.id);
  const selfId = game.players.find((p) => p.isSelf)?.id;
  const suspectToPlayer: Record<string, string> = {};
  for (const p of game.players) if (p.suspect) suspectToPlayer[p.suspect] = p.id;

  const facts: ExtractedFacts['facts'] = [];
  const disjunctions: Disjunction[] = [];
  const failedAccusations: SuggestionCards[] = [];
  let confirmedSolution: SuggestionCards | undefined;
  let winnerId: string | undefined;
  const eliminated: Record<string, boolean> = {};
  const locations: Record<string, LocationState> = {};
  for (const id of playerIds) {
    locations[id] = {
      location: { kind: 'hallway' },
      arrival: 'self',
      eligibleToSuggest: false,
    };
    eliminated[id] = false;
  }

  for (const ev of game.events) {
    if (ev.type === 'movement') {
      locations[ev.playerId] = {
        location: ev.to,
        arrival: ev.arrival,
        eligibleToSuggest: ev.to.kind === 'room',
      };
    } else if (ev.type === 'suggestion') {
      const { suggesterId, cards } = ev;
      const named: CardId[] = [cards.suspect, cards.weapon, cards.room];

      // Movement consequences (§7): suggester is in the named room and has
      // used its suggestion; the named suspect's player is summoned in.
      locations[suggesterId] = {
        location: { kind: 'room', room: cards.room },
        arrival: locations[suggesterId]?.arrival ?? 'self',
        eligibleToSuggest: false,
      };
      const summonedId = suspectToPlayer[cards.suspect];
      if (summonedId && summonedId !== suggesterId) {
        locations[summonedId] = {
          location: { kind: 'room', room: cards.room },
          arrival: 'summoned',
          eligibleToSuggest: true,
        };
      }

      const order = askOrder(playerIds, suggesterId);
      if (ev.outcome.kind === 'none') {
        // No one could disprove: everyone except the suggester lacks all three.
        for (const pid of order) {
          for (const c of named) {
            facts.push({ holder: pid, card: c, mark: 'hasNot', why: 'no one disproved' });
          }
        }
      } else {
        const by = ev.outcome.byId;
        // Players asked before the disprover passed: they lack all three.
        for (const pid of order) {
          if (pid === by) break;
          for (const c of named) {
            facts.push({ holder: pid, card: c, mark: 'hasNot', why: 'passed when asked' });
          }
        }
        if (ev.outcome.shownCard) {
          facts.push({
            holder: by,
            card: ev.outcome.shownCard,
            mark: 'has',
            why: suggesterId === selfId ? 'shown to you' : 'card you showed',
          });
        } else {
          disjunctions.push({ id: ev.id, holder: by, cards: named });
        }
      }
    } else if (ev.type === 'accusation') {
      if (ev.success) {
        confirmedSolution = ev.cards;
        winnerId = ev.accuserId;
      } else {
        failedAccusations.push(ev.cards);
        eliminated[ev.accuserId] = true;
      }
    }
  }

  return {
    facts,
    disjunctions,
    failedAccusations,
    confirmedSolution,
    locations,
    eliminated,
    winnerId,
  };
}

export function analyzeGame(game: Game, settings: Settings): Analysis {
  const playerIds = game.players.map((p) => p.id);
  const self = game.players.find((p) => p.isSelf);
  const selfId = self?.id ?? playerIds[0];
  const extracted = extractFacts(game);

  const names: Record<string, string> = {};
  for (const p of game.players) names[p.id] = p.name;

  const solver = solve({
    playerIds,
    handSizes: Object.fromEntries(game.players.map((p) => [p.id, p.handSize])),
    potCards: game.potCards,
    selfId,
    selfHand: game.yourHand,
    facts: extracted.facts,
    disjunctions: extracted.disjunctions,
    failedAccusations: extracted.failedAccusations,
    confirmedSolution: extracted.confirmedSolution,
    names,
  });

  const rng = mulberry32(hashString(`${game.id}:${game.rev}`));
  const sample = sampleDeals({
    marks: solver.marks,
    playerIds,
    handSizes: Object.fromEntries(game.players.map((p) => [p.id, p.handSize])),
    disjunctions: solver.disjunctions,
    failedAccusations: extracted.failedAccusations,
    rng,
    target: settings.sampleTarget,
    maxAttempts: settings.sampleMaxAttempts,
  });

  const solution = { ...solver.envelope };
  const solvedAll = CATEGORIES.every((c) => solution[c] != null);

  const selfLoc = extracted.locations[selfId];
  const reach = reachAll({
    location:
      selfLoc.location.kind === 'room'
        ? { kind: 'room', room: selfLoc.location.room }
        : { kind: 'hallway' },
    eligibleHere: selfLoc.eligibleToSuggest,
    settings,
  });

  let accuseNow: SuggestionCards | undefined;
  if (solvedAll) {
    accuseNow = {
      suspect: solution.suspect as SuggestionCards['suspect'],
      weapon: solution.weapon as SuggestionCards['weapon'],
      room: solution.room as SuggestionCards['room'],
    };
  }

  const selfEliminated = extracted.eliminated[selfId];
  const recommendations =
    game.status === 'in_progress' &&
    !accuseNow &&
    !selfEliminated &&
    solver.contradictions.length === 0
      ? recommendSuggestions({
          sample,
          playerIds,
          selfId,
          reach,
          yourHand: game.yourHand,
          marks: solver.marks,
          rng,
          selfLocation: selfLoc,
        })
      : [];

  return {
    solver,
    sample,
    locations: extracted.locations,
    eliminated: extracted.eliminated,
    solution,
    solvedAll,
    reach,
    recommendations,
    accuseNow,
    contradictions: solver.contradictions,
  };
}

/** Human-readable one-liner for an event (timeline + review). */
export function describeEvent(ev: GameEvent, game: Game): string {
  const nameOf = (id: string) => game.players.find((p) => p.id === id)?.name ?? '?';
  const selfId = game.players.find((p) => p.isSelf)?.id;
  if (ev.type === 'suggestion') {
    const trio = `${cardName(ev.cards.suspect)} · ${cardName(ev.cards.weapon)} · ${cardName(ev.cards.room)}`;
    const who = nameOf(ev.suggesterId);
    if (ev.outcome.kind === 'none') return `${who} suggested ${trio} — no one disproved`;
    const by = nameOf(ev.outcome.byId);
    if (ev.outcome.shownCard && ev.suggesterId === selfId) {
      return `${who} suggested ${trio} — ${by} showed you ${cardName(ev.outcome.shownCard)}`;
    }
    if (ev.outcome.shownCard && ev.outcome.byId === selfId) {
      return `${who} suggested ${trio} — you showed ${cardName(ev.outcome.shownCard)}`;
    }
    return `${who} suggested ${trio} — ${by} showed a card`;
  }
  if (ev.type === 'accusation') {
    const trio = `${cardName(ev.cards.suspect)} · ${cardName(ev.cards.weapon)} · ${cardName(ev.cards.room)}`;
    return `${nameOf(ev.accuserId)} accused ${trio} — ${ev.success ? 'correct! Case closed' : 'wrong; eliminated'}`;
  }
  const where = ev.to.kind === 'room' ? cardName(ev.to.room) : 'the hallway';
  const how =
    ev.arrival === 'secret_passage'
      ? ' via the secret passage'
      : ev.arrival === 'summoned'
        ? ' (summoned)'
        : '';
  return `${nameOf(ev.playerId)} moved to ${where}${how}`;
}
