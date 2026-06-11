/**
 * Layer 1 — deterministic propagation (PRD §11).
 * Tracks has/hasNot/unknown per card per holder and applies every rule to a
 * fixpoint: card uniqueness, pot knowledge, one envelope card per category,
 * hand-size counting, disjunctions from unseen disproofs, and failed-accusation
 * exclusion. Contradictions are surfaced, never thrown.
 */

import type { CardId, Category } from './cards';
import { ALL_CARDS, CARDS_BY_CATEGORY, CATEGORIES, cardName } from './cards';
import type {
  Disjunction,
  DisjunctionState,
  HolderId,
  Mark,
  Marks,
  SuggestionCards,
} from './types';
import { ENVELOPE, POT } from './types';

export interface SolverInput {
  /** Players in seating order (ids). */
  playerIds: HolderId[];
  handSizes: Record<HolderId, number>;
  potCards: CardId[];
  selfId: HolderId;
  selfHand: CardId[];
  /** Direct facts extracted from events (shown cards, skips, no-disproves…). */
  facts: { holder: HolderId; card: CardId; mark: 'has' | 'hasNot'; why?: string }[];
  /** "Holder showed one of these three" facts from unseen disproofs. */
  disjunctions: Disjunction[];
  /** Failed accusations: that exact triple is not the envelope. */
  failedAccusations: SuggestionCards[];
  /** A successful accusation pins the envelope outright. */
  confirmedSolution?: SuggestionCards;
  /** Holder display names for readable contradiction messages. */
  names?: Record<HolderId, string>;
}

export interface SolverResult {
  marks: Marks;
  holders: HolderId[];
  contradictions: string[];
  disjunctions: DisjunctionState[];
  /** Proven envelope card per category, where known. */
  envelope: Partial<Record<Category, CardId>>;
}

export function emptyMarks(holders: HolderId[]): Marks {
  const marks = {} as Marks;
  for (const c of ALL_CARDS) {
    const row: Record<HolderId, Mark> = {};
    for (const h of holders) row[h] = 'unknown';
    marks[c.id] = row;
  }
  return marks;
}

export function solve(input: SolverInput): SolverResult {
  const holders: HolderId[] = [...input.playerIds, POT, ENVELOPE];
  const marks = emptyMarks(holders);
  const contradictions: string[] = [];
  const names = input.names ?? {};
  const labelOf = (h: HolderId) =>
    h === ENVELOPE ? 'the envelope' : h === POT ? 'the pot' : names[h] ?? h;

  let changed = false;

  const setMark = (card: CardId, holder: HolderId, mark: 'has' | 'hasNot', why?: string) => {
    const current = marks[card][holder];
    if (current === mark) return;
    if (current !== 'unknown') {
      contradictions.push(
        `${cardName(card)} is marked both held and not held by ${labelOf(holder)}` +
          (why ? ` (${why})` : '') + '. Check the last few entries.',
      );
      return;
    }
    marks[card][holder] = mark;
    changed = true;
  };

  // --- Base facts -----------------------------------------------------------
  const potSet = new Set(input.potCards);
  for (const c of ALL_CARDS) {
    setMark(c.id, POT, potSet.has(c.id) ? 'has' : 'hasNot', 'pot is face-up');
  }
  const handSet = new Set(input.selfHand);
  for (const c of ALL_CARDS) {
    setMark(c.id, input.selfId, handSet.has(c.id) ? 'has' : 'hasNot', 'your dealt hand');
  }
  for (const f of input.facts) setMark(f.card, f.holder, f.mark, f.why);
  if (input.confirmedSolution) {
    setMark(input.confirmedSolution.suspect, ENVELOPE, 'has', 'successful accusation');
    setMark(input.confirmedSolution.weapon, ENVELOPE, 'has', 'successful accusation');
    setMark(input.confirmedSolution.room, ENVELOPE, 'has', 'successful accusation');
  }

  const capacities: Record<HolderId, number> = { ...input.handSizes, [POT]: input.potCards.length };
  const disjunctions: DisjunctionState[] = input.disjunctions.map((d) => ({
    ...d,
    remaining: [...d.cards],
  }));

  // --- Fixpoint loop --------------------------------------------------------
  const MAX_PASSES = 200;
  let passes = 0;
  do {
    changed = false;
    passes++;

    // Rule: one holder per card.
    for (const card of ALL_CARDS) {
      const id = card.id;
      const hasHolders = holders.filter((h) => marks[id][h] === 'has');
      if (hasHolders.length > 1) {
        contradictions.push(
          `${card.name} appears to be held by ${hasHolders.map(labelOf).join(' and ')}.`,
        );
        continue;
      }
      if (hasHolders.length === 1) {
        for (const h of holders) {
          if (h !== hasHolders[0]) setMark(id, h, 'hasNot', 'card already placed');
        }
        continue;
      }
      const possible = holders.filter((h) => marks[id][h] !== 'hasNot');
      if (possible.length === 0) {
        contradictions.push(`${card.name} has been ruled out for every holder — something is off.`);
      } else if (possible.length === 1) {
        setMark(id, possible[0], 'has', 'only holder left');
      }
    }

    // Rule: exactly one envelope card per category.
    for (const cat of CATEGORIES) {
      const cards = CARDS_BY_CATEGORY[cat];
      const inEnv = cards.filter((c) => marks[c.id][ENVELOPE] === 'has');
      if (inEnv.length > 1) {
        contradictions.push(
          `Two ${cat} cards (${inEnv.map((c) => c.name).join(', ')}) are both marked as the solution.`,
        );
        continue;
      }
      if (inEnv.length === 1) {
        for (const c of cards) {
          if (c.id !== inEnv[0].id) setMark(c.id, ENVELOPE, 'hasNot', 'category solved');
        }
        continue;
      }
      const candidates = cards.filter((c) => marks[c.id][ENVELOPE] !== 'hasNot');
      if (candidates.length === 0) {
        contradictions.push(`Every ${cat} card has been ruled out of the envelope.`);
      } else if (candidates.length === 1) {
        setMark(candidates[0].id, ENVELOPE, 'has', 'last candidate in category');
      }
    }

    // Rule: hand-size counting per player (and the pot, trivially).
    for (const h of [...input.playerIds, POT]) {
      const cap = capacities[h];
      if (cap == null) continue;
      const hasCards = ALL_CARDS.filter((c) => marks[c.id][h] === 'has');
      const possible = ALL_CARDS.filter((c) => marks[c.id][h] !== 'hasNot');
      if (hasCards.length > cap) {
        contradictions.push(
          `${labelOf(h)} is confirmed to hold ${hasCards.length} cards but only has ${cap}.`,
        );
        continue;
      }
      if (possible.length < cap) {
        contradictions.push(
          `${labelOf(h)} must hold ${cap} cards but only ${possible.length} remain possible.`,
        );
        continue;
      }
      if (hasCards.length === cap) {
        for (const c of possible) {
          if (marks[c.id][h] === 'unknown') setMark(c.id, h, 'hasNot', 'hand is full');
        }
      } else if (possible.length === cap) {
        for (const c of possible) {
          if (marks[c.id][h] === 'unknown') setMark(c.id, h, 'has', 'exactly fills the hand');
        }
      }
    }

    // Rule: disjunctions from unseen disproofs.
    for (const d of disjunctions) {
      if (d.satisfiedBy) continue;
      const proven = d.cards.find((c) => marks[c][d.holder] === 'has');
      if (proven) {
        d.satisfiedBy = proven;
        d.remaining = [proven];
        continue;
      }
      d.remaining = d.cards.filter((c) => marks[c][d.holder] !== 'hasNot');
      if (d.remaining.length === 0) {
        contradictions.push(
          `${labelOf(d.holder)} disproved a suggestion (${d.cards
            .map(cardName)
            .join(', ')}) but now holds none of those cards.`,
        );
      } else if (d.remaining.length === 1) {
        setMark(d.remaining[0], d.holder, 'has', 'only card left from a disproof');
        d.satisfiedBy = d.remaining[0];
      }
    }

    // Rule: a failed accusation rules out that exact triple.
    for (const acc of input.failedAccusations) {
      const triple: CardId[] = [acc.suspect, acc.weapon, acc.room];
      const inEnv = triple.filter((c) => marks[c][ENVELOPE] === 'has');
      const unknown = triple.filter((c) => marks[c][ENVELOPE] === 'unknown');
      if (inEnv.length === 3) {
        contradictions.push(
          `A failed accusation named exactly the proven solution (${triple
            .map(cardName)
            .join(', ')}).`,
        );
      } else if (inEnv.length === 2 && unknown.length === 1) {
        setMark(unknown[0], ENVELOPE, 'hasNot', 'failed accusation rules the triple out');
      }
    }
  } while (changed && passes < MAX_PASSES && contradictions.length === 0);

  // One final sweep of contradiction checks without mutating (in case we
  // stopped early due to a contradiction).
  const envelope: Partial<Record<Category, CardId>> = {};
  for (const cat of CATEGORIES) {
    const found = CARDS_BY_CATEGORY[cat].find((c) => marks[c.id][ENVELOPE] === 'has');
    if (found) envelope[cat] = found.id;
  }

  return {
    marks,
    holders,
    contradictions: dedupe(contradictions),
    disjunctions,
    envelope,
  };
}

function dedupe(list: string[]): string[] {
  return [...new Set(list)];
}
