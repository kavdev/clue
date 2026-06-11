/** PRD §15 acceptance tests 11–13: validation, history buckets, win recording. */

import { beforeEach, describe, expect, it } from 'vitest';
import { bucketFor, groupByBucket } from '../src/domain/dates';
import { validateSetup } from '../src/domain/validate';
import { leaderboardRows } from '../src/domain/leaderboard';
import { useStore } from '../src/store/store';
import { makeGame, makePlayers } from './helpers';
import type { CardId } from '../src/domain/cards';

describe('11. card-math validation', () => {
  it('warns when 3 + hands + pot != 21', () => {
    const game = makeGame({
      players: makePlayers([
        { id: 'me', handSize: 5, self: true },
        { id: 'p2', handSize: 5 },
        { id: 'p3', handSize: 5 },
      ]),
      potCards: [],
    });
    game.potSize = 0; // 3 + 15 + 0 = 18 != 21
    const issues = validateSetup(game);
    expect(issues.some((i) => i.message.includes('21'))).toBe(true);
  });

  it('warns when tapped cards disagree with their counts', () => {
    const game = makeGame({
      players: makePlayers([
        { id: 'me', handSize: 6, self: true },
        { id: 'p2', handSize: 6 },
        { id: 'p3', handSize: 6 },
      ]),
      potCards: ['rope'] as CardId[], // potSize derives to 1 in helper => math 3+18+1=22
      yourHand: ['mustard'] as CardId[],
    });
    const issues = validateSetup(game);
    expect(issues.some((i) => i.message.includes('21'))).toBe(true);
    // Fix the math but leave taps inconsistent:
    game.potSize = 0;
    game.players[0].handSize = 6;
    const issues2 = validateSetup(game);
    expect(issues2.some((i) => i.message.includes('pot'))).toBe(true);
    expect(issues2.some((i) => i.message.includes('hand'))).toBe(true);
  });

  it('accepts a clean setup', () => {
    const game = makeGame({
      players: makePlayers([
        { id: 'me', handSize: 6, self: true },
        { id: 'p2', handSize: 6 },
        { id: 'p3', handSize: 6 },
      ]),
      potCards: [],
      yourHand: ['mustard', 'dagger', 'kitchen', 'ballroom', 'hall', 'plum'] as CardId[],
    });
    expect(validateSetup(game)).toEqual([]);
  });
});

describe('12. history buckets', () => {
  // Wed 2026-06-24, 15:00 local. June 1, 2026 is a Monday.
  const now = new Date(2026, 5, 24, 15, 0).getTime();
  const t = (y: number, m: number, d: number, h = 12) => new Date(y, m, d, h).getTime();

  it('buckets each timestamp under the right humanized group', () => {
    expect(bucketFor(t(2026, 5, 24, 9), now)).toBe('today');
    expect(bucketFor(t(2026, 5, 23), now)).toBe('yesterday');
    expect(bucketFor(t(2026, 5, 22), now)).toBe('thisWeek'); // Monday this week
    expect(bucketFor(t(2026, 5, 17), now)).toBe('lastWeek');
    expect(bucketFor(t(2026, 5, 5), now)).toBe('thisMonth');
    expect(bucketFor(t(2026, 4, 20), now)).toBe('lastMonth');
    expect(bucketFor(t(2026, 1, 1), now)).toBe('older');
  });

  it('groups newest-first within each bucket, buckets in fixed order', () => {
    const items = [
      { id: 'older', at: t(2026, 1, 1) },
      { id: 'today-early', at: t(2026, 5, 24, 8) },
      { id: 'today-late', at: t(2026, 5, 24, 14) },
      { id: 'lastweek', at: t(2026, 5, 17) },
    ];
    const groups = groupByBucket(items, (i) => i.at, now);
    expect(groups.map((g) => g.bucket)).toEqual(['today', 'lastWeek', 'older']);
    expect(groups[0].items.map((i) => i.id)).toEqual(['today-late', 'today-early']);
  });
});

describe('setup deal defaults', () => {
  beforeEach(() => {
    useStore.setState({ roster: [], games: [] });
  });

  it('re-deals evenly as players are added one at a time', () => {
    const s = useStore.getState();
    const ids = ['A', 'B', 'C', 'D'].map((n) => s.addRosterPlayer(n).id);
    const gameId = useStore.getState().createGame();
    for (let i = 1; i <= 4; i++) {
      useStore.getState().setGamePlayers(gameId, ids.slice(0, i));
    }
    const game = useStore.getState().games.find((g) => g.id === gameId)!;
    expect(game.players.map((p) => p.handSize)).toEqual([4, 4, 4, 4]);
    expect(game.potSize).toBe(2);
  });

  it('keeps a manually edited deal while it stays valid', () => {
    const s = useStore.getState();
    const ids = ['A', 'B', 'C', 'D'].map((n) => s.addRosterPlayer(n).id);
    const gameId = useStore.getState().createGame();
    useStore.getState().setGamePlayers(gameId, ids);
    useStore.getState().setHandSize(gameId, ids[0], 5);
    useStore.getState().setHandSize(gameId, ids[1], 3);
    // Re-selecting the same players must not clobber the custom 5/3/4/4+2 deal.
    useStore.getState().setGamePlayers(gameId, ids);
    const game = useStore.getState().games.find((g) => g.id === gameId)!;
    expect(game.players.map((p) => p.handSize)).toEqual([5, 3, 4, 4]);
  });
});

describe('13. win recording', () => {
  beforeEach(() => {
    useStore.setState({ roster: [], games: [] });
  });

  it('successful accusation completes the game, records the winner, updates the leaderboard', () => {
    const s = useStore.getState();
    const alex = s.addRosterPlayer('Alex');
    const blair = s.addRosterPlayer('Blair');
    const casey = s.addRosterPlayer('Casey');

    const gameId = useStore.getState().createGame();
    useStore.getState().setGamePlayers(gameId, [alex.id, blair.id, casey.id]);
    useStore.getState().setSelf(gameId, alex.id);
    useStore.getState().setSuspect(gameId, alex.id, 'scarlett');
    useStore.getState().setSuspect(gameId, blair.id, 'plum');
    useStore.getState().setSuspect(gameId, casey.id, 'peacock');
    const hand: CardId[] = ['mustard', 'dagger', 'kitchen', 'ballroom', 'hall', 'white'];
    for (const c of hand) useStore.getState().toggleHandCard(gameId, c);
    useStore.getState().startGame(gameId);

    useStore.getState().logAccusation(gameId, {
      accuserId: blair.id,
      cards: { suspect: 'plum', weapon: 'rope', room: 'library' },
      success: true,
    });

    const game = useStore.getState().games.find((g) => g.id === gameId)!;
    expect(game.status).toBe('completed');
    expect(game.winnerId).toBe(blair.id);
    expect(game.solution).toEqual({ suspect: 'plum', weapon: 'rope', room: 'library' });
    expect(game.endedAt).toBeDefined();

    const rows = leaderboardRows(useStore.getState().games, useStore.getState().roster);
    expect(rows[0].player.id).toBe(blair.id);
    expect(rows[0].wins).toBe(1);
    expect(rows[0].played).toBe(1);
    expect(rows.find((r) => r.player.id === alex.id)?.wins).toBe(0);
  });

  it('failed accusation eliminates the accuser but the game continues', () => {
    const s = useStore.getState();
    const a = s.addRosterPlayer('A');
    const b = s.addRosterPlayer('B');
    const c = s.addRosterPlayer('C');
    const gameId = useStore.getState().createGame();
    useStore.getState().setGamePlayers(gameId, [a.id, b.id, c.id]);
    useStore.getState().setSelf(gameId, a.id);
    useStore.getState().startGame(gameId);

    useStore.getState().logAccusation(gameId, {
      accuserId: b.id,
      cards: { suspect: 'plum', weapon: 'rope', room: 'library' },
      success: false,
    });
    const game = useStore.getState().games.find((g) => g.id === gameId)!;
    expect(game.status).toBe('in_progress');
    expect(game.players.find((p) => p.id === b.id)?.eliminated).toBe(true);

    // Undo restores them.
    useStore.getState().undoLast(gameId);
    const game2 = useStore.getState().games.find((g) => g.id === gameId)!;
    expect(game2.players.find((p) => p.id === b.id)?.eliminated).toBe(false);
  });
});
