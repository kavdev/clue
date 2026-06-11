/**
 * Layer 2 — Monte Carlo sampling of constraint-consistent deals (PRD §11).
 * Each sample is a complete card→holder assignment honoring the pot, your
 * hand, every Layer-1 mark, hand sizes, one envelope card per category,
 * every unresolved disjunction, and every failed accusation.
 */

import type { CardId, Category } from './cards';
import { ALL_CARDS, CARDS_BY_CATEGORY, CARD_INDEX, CATEGORIES } from './cards';
import type { DisjunctionState, HolderId, Marks, SuggestionCards } from './types';
import { ENVELOPE } from './types';
import type { Rng } from './rng';
import { shuffleInPlace } from './rng';

export interface Deal {
  /** holder index per card, in ALL_CARDS order. */
  holders: Uint8Array;
  /** envelope card index per category: [suspect, weapon, room]. */
  envelope: [number, number, number];
}

export interface SampleResult {
  samples: Deal[];
  accepted: number;
  attempts: number;
  /** Order of holder indices used inside deals: players…, POT, ENVELOPE. */
  holderOrder: HolderId[];
  /** P(card in envelope); deterministic 0/1 for proven cards. */
  envelopeProb: Record<CardId, number>;
  /** True when sampling failed and probabilities fell back to uniform-over-candidates. */
  lowConfidence: boolean;
}

export interface SamplerInput {
  marks: Marks;
  playerIds: HolderId[];
  handSizes: Record<HolderId, number>;
  disjunctions: DisjunctionState[];
  failedAccusations: SuggestionCards[];
  rng: Rng;
  target?: number;
  maxAttempts?: number;
}

export function sampleDeals(input: SamplerInput): SampleResult {
  const { marks, playerIds, handSizes, rng } = input;
  const target = input.target ?? 2500;
  const maxAttempts = input.maxAttempts ?? 30000;

  const holderOrder: HolderId[] = [...playerIds, 'POT', ENVELOPE];
  const holderIdx: Record<HolderId, number> = {};
  holderOrder.forEach((h, i) => (holderIdx[h] = i));
  const ENV_I = holderIdx[ENVELOPE];

  // Fixed placements and per-card allowed players from Layer-1 marks.
  const fixedHolder = new Int8Array(ALL_CARDS.length).fill(-1);
  const allowedPlayers: number[][] = [];
  const envAllowed: boolean[] = [];
  for (const card of ALL_CARDS) {
    const i = CARD_INDEX[card.id];
    const row = marks[card.id];
    const owner = holderOrder.find((h) => row[h] === 'has');
    fixedHolder[i] = owner != null ? holderIdx[owner] : -1;
    allowedPlayers.push(
      playerIds.filter((p) => row[p] !== 'hasNot').map((p) => holderIdx[p]),
    );
    envAllowed.push(row[ENVELOPE] !== 'hasNot');
  }

  // Envelope candidates per category (fixed card or open list).
  const envCandidates: Record<Category, number[]> = { suspect: [], weapon: [], room: [] };
  const envFixed: Record<Category, number> = { suspect: -1, weapon: -1, room: -1 };
  for (const cat of CATEGORIES) {
    for (const card of CARDS_BY_CATEGORY[cat]) {
      const i = CARD_INDEX[card.id];
      if (fixedHolder[i] === ENV_I) envFixed[cat] = i;
      else if (fixedHolder[i] === -1 && envAllowed[i]) envCandidates[cat].push(i);
    }
  }

  // Remaining capacity per player after fixed `has` cards.
  const baseCapacity = holderOrder.map((h) =>
    h === ENVELOPE || h === 'POT' ? 0 : handSizes[h] ?? 0,
  );
  for (let i = 0; i < ALL_CARDS.length; i++) {
    const f = fixedHolder[i];
    if (f >= 0 && f !== ENV_I && holderOrder[f] !== 'POT') baseCapacity[f]--;
  }

  const openDisjunctions = input.disjunctions
    .filter((d) => !d.satisfiedBy)
    .map((d) => ({
      holder: holderIdx[d.holder],
      cards: d.remaining.map((c) => CARD_INDEX[c]),
    }));
  const failedTriples = input.failedAccusations.map((a) => [
    CARD_INDEX[a.suspect],
    CARD_INDEX[a.weapon],
    CARD_INDEX[a.room],
  ]);

  const samples: Deal[] = [];
  const envCounts = new Float64Array(ALL_CARDS.length);
  let attempts = 0;

  attemptLoop: while (samples.length < target && attempts < maxAttempts) {
    attempts++;
    const holders = new Uint8Array(ALL_CARDS.length);
    const capacity = [...baseCapacity];

    // 1. Choose the envelope, one card per category.
    const envPick: [number, number, number] = [-1, -1, -1];
    for (let c = 0; c < CATEGORIES.length; c++) {
      const cat = CATEGORIES[c];
      if (envFixed[cat] >= 0) {
        envPick[c] = envFixed[cat];
      } else {
        const cands = envCandidates[cat];
        if (cands.length === 0) break attemptLoop; // contradiction; nothing to sample
        envPick[c] = cands[Math.floor(rng() * cands.length)];
      }
    }

    // 2. Place fixed cards, then deal the rest randomly into open hands.
    const unplaced: number[] = [];
    for (let i = 0; i < ALL_CARDS.length; i++) {
      if (i === envPick[0] || i === envPick[1] || i === envPick[2]) {
        holders[i] = ENV_I;
      } else if (fixedHolder[i] >= 0) {
        holders[i] = fixedHolder[i];
      } else {
        unplaced.push(i);
      }
    }
    shuffleInPlace(unplaced, rng);
    for (const i of unplaced) {
      const options = allowedPlayers[i].filter((p) => capacity[p] > 0);
      if (options.length === 0) continue attemptLoop;
      const p = options[Math.floor(rng() * options.length)];
      holders[i] = p;
      capacity[p]--;
    }
    for (const c of capacity) if (c !== 0) continue attemptLoop;

    // 3. Reject deals violating disjunctions or failed accusations.
    for (const d of openDisjunctions) {
      let ok = false;
      for (const card of d.cards) {
        if (holders[card] === d.holder) {
          ok = true;
          break;
        }
      }
      if (!ok) continue attemptLoop;
    }
    for (const t of failedTriples) {
      if (holders[t[0]] === ENV_I && holders[t[1]] === ENV_I && holders[t[2]] === ENV_I) {
        continue attemptLoop;
      }
    }

    samples.push({ holders, envelope: envPick });
    envCounts[envPick[0]]++;
    envCounts[envPick[1]]++;
    envCounts[envPick[2]]++;
  }

  // Probabilities: deterministic facts always win; sampled estimates otherwise.
  const envelopeProb = {} as Record<CardId, number>;
  const lowConfidence = samples.length === 0;
  for (const cat of CATEGORIES) {
    const cards = CARDS_BY_CATEGORY[cat];
    const candidates = cards.filter((c) => marks[c.id][ENVELOPE] !== 'hasNot');
    for (const card of cards) {
      const i = CARD_INDEX[card.id];
      if (marks[card.id][ENVELOPE] === 'has') envelopeProb[card.id] = 1;
      else if (marks[card.id][ENVELOPE] === 'hasNot') envelopeProb[card.id] = 0;
      else if (samples.length > 0) envelopeProb[card.id] = envCounts[i] / samples.length;
      else envelopeProb[card.id] = candidates.length > 0 ? 1 / candidates.length : 0;
    }
  }

  return {
    samples,
    accepted: samples.length,
    attempts,
    holderOrder,
    envelopeProb,
    lowConfidence,
  };
}
