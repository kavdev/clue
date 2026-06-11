/**
 * PRD §15 acceptance tests 1–9: the two-layer solver.
 * Fixture: 4 players (me, p2, p3, p4), 4 cards each; pot = candlestick + study.
 */

import { describe, expect, it } from 'vitest';
import { analyzeGame } from '../src/domain/derive';
import { ENVELOPE, POT } from '../src/domain/types';
import { ALL_CARDS, SUSPECTS, WEAPONS, ROOM_CARDS } from '../src/domain/cards';
import type { CardId } from '../src/domain/cards';
import { TEST_SETTINGS, accusation, makeGame, makePlayers, suggestion } from './helpers';

const POT_CARDS: CardId[] = ['candlestick', 'study'];
const MY_HAND: CardId[] = ['mustard', 'dagger', 'kitchen', 'ballroom'];

function fixture(events: ReturnType<typeof suggestion>[] = []) {
  return makeGame({
    players: makePlayers([
      { id: 'me', handSize: 4, self: true },
      { id: 'p2', handSize: 4 },
      { id: 'p3', handSize: 4 },
      { id: 'p4', handSize: 4 },
    ]),
    potCards: POT_CARDS,
    yourHand: MY_HAND,
    events,
  });
}

describe('1. positive resolves the board', () => {
  it('marking a card has for one player makes it hasNot everywhere else', () => {
    const game = fixture([
      suggestion('me', { suspect: 'scarlett', weapon: 'rope', room: 'library' }, {
        kind: 'disproved',
        byId: 'p3',
        shownCard: 'rope',
      }),
    ]);
    const { solver } = analyzeGame(game, TEST_SETTINGS);
    expect(solver.marks.rope.p3).toBe('has');
    for (const holder of ['me', 'p2', 'p4', ENVELOPE, POT]) {
      expect(solver.marks.rope[holder]).toBe('hasNot');
    }
  });
});

describe('2. pot eliminates', () => {
  it('pot cards are excluded from every hand and the envelope', () => {
    const { solver } = analyzeGame(fixture(), TEST_SETTINGS);
    for (const card of POT_CARDS) {
      expect(solver.marks[card][POT]).toBe('has');
      for (const holder of ['me', 'p2', 'p3', 'p4', ENVELOPE]) {
        expect(solver.marks[card][holder]).toBe('hasNot');
      }
    }
  });
});

describe('3. empty row stamps the envelope', () => {
  it('a card hasNot for every player becomes the category solution', () => {
    const game = fixture([
      suggestion('me', { suspect: 'plum', weapon: 'rope', room: 'library' }, { kind: 'none' }),
    ]);
    const { solver } = analyzeGame(game, TEST_SETTINGS);
    // plum: not mine, not pot, no one disproved => every player lacks it.
    expect(solver.marks.plum[ENVELOPE]).toBe('has');
    expect(solver.envelope.suspect).toBe('plum');
  });
});

describe('4. disjunction resolves later', () => {
  it('hidden disproof narrows to the only remaining card', () => {
    const game = fixture([
      // p2 suggests; p3 disproves unseen -> p3 holds one of the three.
      suggestion('p2', { suspect: 'scarlett', weapon: 'rope', room: 'library' }, {
        kind: 'disproved',
        byId: 'p3',
      }),
      // Later: Scarlett and Rope are proven to live elsewhere.
      suggestion('me', { suspect: 'scarlett', weapon: 'wrench', room: 'hall' }, {
        kind: 'disproved',
        byId: 'p2',
        shownCard: 'scarlett',
      }),
      suggestion('me', { suspect: 'white', weapon: 'rope', room: 'hall' }, {
        kind: 'disproved',
        byId: 'p4',
        shownCard: 'rope',
      }),
    ]);
    const { solver } = analyzeGame(game, TEST_SETTINGS);
    expect(solver.marks.library.p3).toBe('has');
  });
});

describe('5. hand-size elimination', () => {
  it('a full hand rules out every other card for that player', () => {
    const game = fixture([
      suggestion('me', { suspect: 'scarlett', weapon: 'rope', room: 'library' }, {
        kind: 'disproved',
        byId: 'p2',
        shownCard: 'scarlett',
      }),
      suggestion('me', { suspect: 'white', weapon: 'rope', room: 'library' }, {
        kind: 'disproved',
        byId: 'p2',
        shownCard: 'white',
      }),
      suggestion('me', { suspect: 'green', weapon: 'rope', room: 'library' }, {
        kind: 'disproved',
        byId: 'p2',
        shownCard: 'green',
      }),
      suggestion('me', { suspect: 'peacock', weapon: 'rope', room: 'library' }, {
        kind: 'disproved',
        byId: 'p2',
        shownCard: 'peacock',
      }),
    ]);
    const { solver } = analyzeGame(game, TEST_SETTINGS);
    // p2's hand of 4 is fully known: scarlett, white, green, peacock.
    for (const card of ALL_CARDS) {
      const expected = ['scarlett', 'white', 'green', 'peacock'].includes(card.id)
        ? 'has'
        : 'hasNot';
      expect(solver.marks[card.id].p2, card.id).toBe(expected);
    }
  });
});

describe('6. no-disprove pressure', () => {
  it('undisproved suggestion of cards you lack raises their envelope odds', () => {
    const before = analyzeGame(fixture(), TEST_SETTINGS);
    const game = fixture([
      suggestion('me', { suspect: 'plum', weapon: 'rope', room: 'library' }, { kind: 'none' }),
    ]);
    const after = analyzeGame(game, TEST_SETTINGS);
    for (const card of ['plum', 'rope', 'library'] as CardId[]) {
      for (const other of ['p2', 'p3', 'p4']) {
        expect(after.solver.marks[card][other]).toBe('hasNot');
      }
      expect(after.sample.envelopeProb[card]).toBeGreaterThan(
        before.sample.envelopeProb[card],
      );
      // In this fixture nothing else can hold them: they are the solution.
      expect(after.sample.envelopeProb[card]).toBe(1);
    }
  });
});

describe('7. skip deduction', () => {
  it('players asked and passed lack all three named cards', () => {
    const game = fixture([
      suggestion('me', { suspect: 'scarlett', weapon: 'rope', room: 'library' }, {
        kind: 'disproved',
        byId: 'p4',
        shownCard: 'scarlett',
      }),
    ]);
    const { solver } = analyzeGame(game, TEST_SETTINGS);
    for (const card of ['scarlett', 'rope', 'library'] as CardId[]) {
      expect(solver.marks[card].p2).toBe('hasNot');
      expect(solver.marks[card].p3).toBe('hasNot');
    }
  });
});

describe('8. eliminated still disproves', () => {
  it('a failed accuser keeps disproving and the solver keeps deducing', () => {
    const game = fixture([
      accusation('p2', { suspect: 'scarlett', weapon: 'rope', room: 'library' }, false),
      // p2 (eliminated) disproves p3's suggestion, card unseen.
      suggestion('p3', { suspect: 'peacock', weapon: 'wrench', room: 'hall' }, {
        kind: 'disproved',
        byId: 'p2',
      }),
      // I ask nearly the same trio; p2 passes, p3 shows me the lead pipe.
      suggestion('me', { suspect: 'peacock', weapon: 'leadpipe', room: 'hall' }, {
        kind: 'disproved',
        byId: 'p3',
        shownCard: 'leadpipe',
      }),
    ]);
    const analysis = analyzeGame(game, TEST_SETTINGS);
    expect(analysis.eliminated.p2).toBe(true);
    // p2 passed on {peacock, leadpipe, hall} but disproved {peacock, wrench, hall}
    // earlier: the only card left is the wrench.
    expect(analysis.solver.marks.wrench.p2).toBe('has');
    expect(analysis.solver.marks.peacock.p2).toBe('hasNot');
    expect(analysis.solver.marks.hall.p2).toBe('hasNot');
  });
});

describe('9. probabilities sum sanely', () => {
  it('per category, envelope probabilities sum to ~100%; proven cards read 0/100', () => {
    const game = fixture([
      suggestion('me', { suspect: 'plum', weapon: 'rope', room: 'library' }, { kind: 'none' }),
      suggestion('me', { suspect: 'scarlett', weapon: 'revolver', room: 'hall' }, {
        kind: 'disproved',
        byId: 'p2',
        shownCard: 'revolver',
      }),
    ]);
    const { sample, solver } = analyzeGame(game, TEST_SETTINGS);
    expect(sample.accepted).toBeGreaterThan(0);
    for (const group of [SUSPECTS, WEAPONS, ROOM_CARDS]) {
      const sum = group.reduce((acc, c) => acc + sample.envelopeProb[c.id], 0);
      expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
    }
    // Proven solution cards read exactly 100%, proven-held cards exactly 0%.
    expect(sample.envelopeProb.plum).toBe(1);
    expect(sample.envelopeProb.rope).toBe(1);
    expect(sample.envelopeProb.library).toBe(1);
    expect(sample.envelopeProb.revolver).toBe(0);
    expect(solver.marks.revolver.p2).toBe('has');
  });
});
