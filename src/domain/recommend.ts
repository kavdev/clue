/**
 * Recommended next move (PRD §12): rank candidate suggestions by
 * expected information gain (entropy reduction over the envelope
 * distribution, estimated from Layer-2 samples) × reachability.
 */

import type { CardId, RoomId, SuspectId, WeaponId } from './cards';
import { CARD_INDEX, ROOM_IDS, SUSPECTS, WEAPONS, cardName } from './cards';
import { secretPassageFrom } from './board';
import type { LocationState, Marks, Recommendation } from './types';
import { ENVELOPE } from './types';
import type { SampleResult } from './sampler';
import type { Rng } from './rng';

export interface RecommendInput {
  sample: SampleResult;
  /** Seating order. */
  playerIds: string[];
  selfId: string;
  reach: Record<RoomId, number>;
  yourHand: CardId[];
  marks: Marks;
  rng: Rng;
  selfLocation: LocationState;
  maxSamples?: number;
  top?: number;
}

function entropyOfCounts(counts: Map<number, number>, total: number): number {
  let h = 0;
  for (const n of counts.values()) {
    if (n === 0) continue;
    const p = n / total;
    h -= p * Math.log(p);
  }
  return h;
}

/** Entropy of the envelope distribution (sum across the three categories). */
function envelopeEntropy(deals: { envelope: [number, number, number] }[]): number {
  let h = 0;
  for (let c = 0; c < 3; c++) {
    const counts = new Map<number, number>();
    for (const d of deals) counts.set(d.envelope[c], (counts.get(d.envelope[c]) ?? 0) + 1);
    h += entropyOfCounts(counts, deals.length);
  }
  return h;
}

export function recommendSuggestions(input: RecommendInput): Recommendation[] {
  const { sample, playerIds, selfId, reach, yourHand, marks, rng } = input;
  if (sample.samples.length === 0) return [];
  const top = input.top ?? 3;

  const maxSamples = input.maxSamples ?? 1500;
  const deals =
    sample.samples.length > maxSamples ? sample.samples.slice(0, maxSamples) : sample.samples;

  // Ask order: every other player after you, wrapping. Eliminated players
  // still disprove, so nobody is skipped.
  const selfSeat = playerIds.indexOf(selfId);
  const askSeats: number[] = [];
  for (let k = 1; k < playerIds.length; k++) {
    askSeats.push((selfSeat + k) % playerIds.length);
  }
  // Holder index inside deals matches playerIds order (players first).
  const baseEntropy = envelopeEntropy(deals);
  const handSet = new Set(yourHand);

  interface Best {
    suspect: SuspectId;
    weapon: WeaponId;
    info: number;
  }
  const bestPerRoom = new Map<RoomId, Best>();

  for (const room of ROOM_IDS) {
    if (reach[room] <= 0) continue;
    const roomIdx = CARD_INDEX[room];
    let best: Best | null = null;

    for (const s of SUSPECTS) {
      for (const w of WEAPONS) {
        const named = [CARD_INDEX[s.id], CARD_INDEX[w.id], roomIdx];
        // Partition samples by the observable outcome: (disprover, card shown).
        const groups = new Map<number, { envelope: [number, number, number] }[]>();
        for (const deal of deals) {
          let key = -1; // "no one disproved"
          for (const seat of askSeats) {
            const held = named.filter((ci) => deal.holders[ci] === seat);
            if (held.length > 0) {
              const shown = held.length === 1 ? held[0] : held[Math.floor(rng() * held.length)];
              key = seat * 32 + shown;
              break;
            }
          }
          let g = groups.get(key);
          if (!g) groups.set(key, (g = []));
          g.push(deal);
        }
        let expected = 0;
        for (const g of groups.values()) {
          expected += (g.length / deals.length) * envelopeEntropy(g);
        }
        const info = baseEntropy - expected;
        if (!best || info > best.info) {
          best = { suspect: s.id as SuspectId, weapon: w.id as WeaponId, info };
        }
      }
    }
    if (best) bestPerRoom.set(room, best);
  }

  const recs: Recommendation[] = [];
  for (const [room, best] of bestPerRoom) {
    const viaSecretPassage =
      input.selfLocation.location.kind === 'room' &&
      secretPassageFrom(input.selfLocation.location.room) === room;
    recs.push({
      room,
      suspect: best.suspect,
      weapon: best.weapon,
      reach: reach[room],
      viaSecretPassage,
      info: best.info,
      score: best.info * reach[room],
      note: buildNote({ room, suspect: best.suspect, weapon: best.weapon }, handSet, marks),
    });
  }
  recs.sort((a, b) => b.score - a.score);
  return recs.slice(0, top);
}

function buildNote(
  cards: { suspect: SuspectId; weapon: WeaponId; room: RoomId },
  handSet: Set<CardId>,
  marks: Marks,
): string {
  const named: CardId[] = [cards.suspect, cards.weapon, cards.room];
  const probes = named.filter(
    (c) => !handSet.has(c) && marks[c][ENVELOPE] === 'unknown',
  );
  const held = named.filter((c) => handSet.has(c));
  if (probes.length === 0) return 'Re-tests known ground — low risk, keeps your hand hidden.';
  const probeText = probes.map(cardName).join(' & ');
  if (held.length === 2) {
    return `You hold ${held.map(cardName).join(' & ')}, so any card shown must be ${probeText}.`;
  }
  if (held.length === 1) {
    return `Tests ${probeText} (you hold ${cardName(held[0])}).`;
  }
  return `Tests ${probeText}.`;
}
