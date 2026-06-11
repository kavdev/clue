/** PRD §15 acceptance test 10: reachability math. */

import { describe, expect, it } from 'vitest';
import {
  defaultBoardSettings,
  doorDiscount,
  effectiveSteps,
  p2d6AtLeast,
  reachProbability,
  secretPassageFrom,
  tierBetween,
} from '../src/domain/board';

const settings = defaultBoardSettings();

describe('10. reachability math', () => {
  it('2d6 cumulative distribution', () => {
    expect(p2d6AtLeast(2)).toBe(1);
    expect(p2d6AtLeast(4)).toBeCloseTo(33 / 36, 12);
    expect(p2d6AtLeast(7)).toBeCloseTo(21 / 36, 12);
    expect(p2d6AtLeast(10)).toBeCloseTo(6 / 36, 12);
    expect(p2d6AtLeast(12)).toBeCloseTo(1 / 36, 12);
    expect(p2d6AtLeast(13)).toBe(0);
  });

  it('secret passages are guaranteed (reach = 1)', () => {
    expect(secretPassageFrom('study')).toBe('kitchen');
    expect(secretPassageFrom('lounge')).toBe('conservatory');
    const ctx = { location: { kind: 'room', room: 'study' } as const, eligibleHere: false, settings };
    expect(reachProbability('kitchen', ctx)).toBe(1);
  });

  it('the current room is reach = 1 when eligible to suggest', () => {
    const ctx = { location: { kind: 'room', room: 'hall' } as const, eligibleHere: true, settings };
    expect(reachProbability('hall', ctx)).toBe(1);
  });

  it('near/mid/far rooms report P(2d6 >= mapped steps)', () => {
    // Hall -> Lounge is near (4 steps, 1 door: no discount).
    const fromHall = { location: { kind: 'room', room: 'hall' } as const, eligibleHere: false, settings };
    expect(tierBetween('hall', 'lounge', settings.matrix)).toBe('near');
    expect(reachProbability('lounge', fromHall)).toBeCloseTo(p2d6AtLeast(4), 12);

    // Hall -> Dining is mid (7 steps, 2 doors: no discount).
    expect(tierBetween('hall', 'dining', settings.matrix)).toBe('mid');
    expect(reachProbability('dining', fromHall)).toBeCloseTo(p2d6AtLeast(7), 12);

    // Study -> Dining is far (10 steps, 2 doors: no discount).
    const fromStudy = { location: { kind: 'room', room: 'study' } as const, eligibleHere: false, settings };
    expect(tierBetween('study', 'dining', settings.matrix)).toBe('far');
    expect(reachProbability('dining', fromStudy)).toBeCloseTo(p2d6AtLeast(10), 12);
  });

  it('extra doorways shorten the approach', () => {
    expect(doorDiscount('ballroom')).toBe(2);
    expect(doorDiscount('hall')).toBe(1);
    expect(doorDiscount('library')).toBe(0);
    // Study -> Ballroom: far tier (10) minus 2 for four doors.
    expect(effectiveSteps(settings.tierSteps.far, 'ballroom')).toBe(8);
    const fromStudy = { location: { kind: 'room', room: 'study' } as const, eligibleHere: false, settings };
    expect(reachProbability('ballroom', fromStudy)).toBeCloseTo(p2d6AtLeast(8), 12);
  });

  it('hallway uses the editable hallway step count', () => {
    const ctx = { location: { kind: 'hallway' } as const, eligibleHere: false, settings };
    expect(reachProbability('lounge', ctx)).toBeCloseTo(p2d6AtLeast(settings.hallwaySteps), 12);
  });
});
