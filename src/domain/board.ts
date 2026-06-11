/**
 * Board model for the 1998 Parker Brothers Classic edition (PRD §6).
 * Distance tiers are a heuristic over the real layout, shipped as an
 * editable matrix; reachability uses the 2d6 distribution.
 */

import type { RoomId } from './cards';
import { ROOM_IDS } from './cards';

export type Tier = 'near' | 'mid' | 'far';

export interface BoardSettings {
  /** Representative step counts per tier (editable; defaults near 4 / mid 7 / far 10). */
  tierSteps: { near: number; mid: number; far: number };
  /** Steps assumed from an unspecified hallway position to any room. */
  hallwaySteps: number;
  /** Symmetric room-to-room tier matrix. */
  matrix: Record<RoomId, Partial<Record<RoomId, Tier>>>;
}

/** Doorways per room — more doors means an easier approach (PRD §6). */
export const DOORS: Record<RoomId, number> = {
  ballroom: 4,
  hall: 3,
  library: 2,
  billiard: 2,
  dining: 2,
  study: 1,
  lounge: 1,
  conservatory: 1,
  kitchen: 1,
};

/** Secret passages: corner-to-corner, one turn, no roll. */
export const SECRET_PASSAGES: [RoomId, RoomId][] = [
  ['study', 'kitchen'],
  ['lounge', 'conservatory'],
];

export function secretPassageFrom(room: RoomId): RoomId | undefined {
  for (const [a, b] of SECRET_PASSAGES) {
    if (a === room) return b;
    if (b === room) return a;
  }
  return undefined;
}

/** Perimeter start squares (metadata; optional seeding, future use). */
export const START_SQUARES: Record<string, string> = {
  scarlett: 'top edge, by the Hall',
  mustard: 'right edge, by Lounge/Dining',
  white: 'bottom edge, by the Ballroom',
  green: 'bottom edge, by the Ballroom',
  peacock: 'left edge, by the Billiard Room',
  plum: 'left edge, by Study/Library',
};

/** Tier neighbor lists straight from the PRD; unlisted pairs default to far. */
const NEAR: [RoomId, RoomId][] = [
  ['study', 'hall'],
  ['study', 'library'],
  ['hall', 'lounge'],
  ['lounge', 'dining'],
  ['library', 'billiard'],
  ['billiard', 'conservatory'],
  ['dining', 'kitchen'],
  ['conservatory', 'ballroom'],
  ['ballroom', 'kitchen'],
];

const MID: [RoomId, RoomId][] = [
  ['hall', 'library'],
  ['hall', 'dining'],
  ['hall', 'ballroom'],
  ['billiard', 'dining'],
];

export function defaultMatrix(): Record<RoomId, Partial<Record<RoomId, Tier>>> {
  const matrix = {} as Record<RoomId, Partial<Record<RoomId, Tier>>>;
  for (const r of ROOM_IDS) matrix[r] = {};
  const put = (a: RoomId, b: RoomId, t: Tier) => {
    matrix[a][b] = t;
    matrix[b][a] = t;
  };
  for (const [a, b] of NEAR) put(a, b, 'near');
  for (const [a, b] of MID) put(a, b, 'mid');
  return matrix;
}

export function defaultBoardSettings(): BoardSettings {
  return {
    tierSteps: { near: 4, mid: 7, far: 10 },
    hallwaySteps: 7,
    matrix: defaultMatrix(),
  };
}

export function tierBetween(
  a: RoomId,
  b: RoomId,
  matrix: Record<RoomId, Partial<Record<RoomId, Tier>>>,
): Tier {
  if (a === b) return 'near';
  return matrix[a]?.[b] ?? 'far';
}

/** P(2d6 >= s) from the triangular distribution; players may stop short, so overshoot is fine. */
export function p2d6AtLeast(steps: number): number {
  if (steps <= 2) return 1;
  if (steps > 12) return 0;
  // outcomes of 2d6 summing to >= steps, out of 36
  const atLeast: Record<number, number> = {
    3: 35, 4: 33, 5: 30, 6: 26, 7: 21, 8: 15, 9: 10, 10: 6, 11: 3, 12: 1,
  };
  return atLeast[steps] / 36;
}

/**
 * Rooms with several doorways resolve to the nearest door, shortening the
 * effective approach (PRD §6). Floor of 3 steps so nothing reads as guaranteed
 * unless it actually is (same room / secret passage).
 */
export function doorDiscount(room: RoomId): number {
  const doors = DOORS[room];
  if (doors >= 4) return 2;
  if (doors >= 3) return 1;
  return 0;
}

export function effectiveSteps(baseSteps: number, room: RoomId): number {
  return Math.max(3, baseSteps - doorDiscount(room));
}

export interface ReachContext {
  /** Where the player is right now. */
  location: { kind: 'room'; room: RoomId } | { kind: 'hallway' };
  /** May they suggest in the room they currently occupy (entered/summoned, not yet used)? */
  eligibleHere: boolean;
  settings: BoardSettings;
}

/**
 * Probability of being able to make a suggestion in `room` this turn (PRD §6).
 */
export function reachProbability(room: RoomId, ctx: ReachContext): number {
  const { location, eligibleHere, settings } = ctx;
  if (location.kind === 'room') {
    if (location.room === room) {
      if (eligibleHere) return 1;
      // Already suggested here: must exit and re-enter — treat as a near-tier trip.
      return p2d6AtLeast(effectiveSteps(settings.tierSteps.near, room));
    }
    if (secretPassageFrom(location.room) === room) return 1;
    const tier = tierBetween(location.room, room, settings.matrix);
    return p2d6AtLeast(effectiveSteps(settings.tierSteps[tier], room));
  }
  return p2d6AtLeast(effectiveSteps(settings.hallwaySteps, room));
}

export function reachAll(ctx: ReachContext): Record<RoomId, number> {
  const out = {} as Record<RoomId, number>;
  for (const r of ROOM_IDS) out[r] = reachProbability(r, ctx);
  return out;
}
