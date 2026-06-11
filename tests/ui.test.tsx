// @vitest-environment jsdom
/** Smoke tests: the app renders, setup flows into a live game with solver output. */

import { beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import App from '../src/App';
import { useStore } from '../src/store/store';
import type { CardId } from '../src/domain/cards';

beforeEach(() => {
  cleanup();
  useStore.setState({ roster: [], games: [] });
  window.location.hash = '#/';
});

describe('app shell', () => {
  it('renders the masthead and empty history', () => {
    render(<App />);
    expect(screen.getByText('CLUE')).toBeTruthy();
    expect(screen.getByText(/No cases on file yet/i)).toBeTruthy();
    expect(screen.getByText(/Open a new case/i)).toBeTruthy();
  });

  it('renders a live game with envelope odds and the deduction grid', () => {
    const s = useStore.getState();
    const a = s.addRosterPlayer('Alex');
    const b = s.addRosterPlayer('Blair');
    const c = s.addRosterPlayer('Casey');
    const gameId = useStore.getState().createGame();
    useStore.getState().setGamePlayers(gameId, [a.id, b.id, c.id]);
    useStore.getState().setSelf(gameId, a.id);
    useStore.getState().setSuspect(gameId, a.id, 'scarlett');
    useStore.getState().setSuspect(gameId, b.id, 'plum');
    useStore.getState().setSuspect(gameId, c.id, 'peacock');
    const hand: CardId[] = ['mustard', 'dagger', 'kitchen', 'ballroom', 'hall', 'white'];
    for (const card of hand) useStore.getState().toggleHandCard(gameId, card);
    useStore.getState().startGame(gameId);

    window.location.hash = `#/game/${gameId}`;
    render(<App />);
    expect(screen.getByText(/The envelope/i)).toBeTruthy();
    expect(screen.getByText(/Deduction grid/i)).toBeTruthy();
    expect(screen.getByText(/Recommended next move/i)).toBeTruthy();
    expect(screen.getByText(/TURN 1/i)).toBeTruthy();
  });

  it("hides your recommendations and position on another player's turn", () => {
    const s = useStore.getState();
    const a = s.addRosterPlayer('Alex');
    const b = s.addRosterPlayer('Blair');
    const c = s.addRosterPlayer('Casey');
    const gameId = useStore.getState().createGame();
    useStore.getState().setGamePlayers(gameId, [a.id, b.id, c.id]);
    useStore.getState().setSelf(gameId, a.id);
    // Blair plays Scarlett, so the opening turn belongs to Blair, not you.
    useStore.getState().setSuspect(gameId, a.id, 'plum');
    useStore.getState().setSuspect(gameId, b.id, 'scarlett');
    useStore.getState().setSuspect(gameId, c.id, 'peacock');
    const hand: CardId[] = ['mustard', 'dagger', 'kitchen', 'ballroom', 'hall', 'white'];
    for (const card of hand) useStore.getState().toggleHandCard(gameId, card);
    useStore.getState().startGame(gameId);

    window.location.hash = `#/game/${gameId}`;
    render(<App />);
    expect(screen.getAllByText('Blair').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Recommended next move/i)).toBeNull();
    expect(screen.queryByText(/Your position/i)).toBeNull();
    expect(screen.getByText(/The envelope/i)).toBeTruthy();
  });

  it('renders review for a completed game with the winner', () => {
    const s = useStore.getState();
    const a = s.addRosterPlayer('Alex');
    const b = s.addRosterPlayer('Blair');
    const c = s.addRosterPlayer('Casey');
    const gameId = useStore.getState().createGame();
    useStore.getState().setGamePlayers(gameId, [a.id, b.id, c.id]);
    useStore.getState().setSelf(gameId, a.id);
    useStore.getState().startGame(gameId);
    useStore.getState().logAccusation(gameId, {
      accuserId: b.id,
      cards: { suspect: 'plum', weapon: 'rope', room: 'library' },
      success: true,
    });

    window.location.hash = `#/review/${gameId}`;
    render(<App />);
    expect(screen.getByText(/Solved by Blair/i)).toBeTruthy();
    expect(screen.getByText(/Full case log/i)).toBeTruthy();
  });
});
