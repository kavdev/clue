/** Setup card-math validation (PRD §10.6 / acceptance test 11). */

import type { Game } from './types';

export interface SetupIssue {
  level: 'error' | 'warn';
  message: string;
}

export function validateSetup(game: Game): SetupIssue[] {
  const issues: SetupIssue[] = [];
  const players = game.players;

  if (players.length < 3) {
    issues.push({ level: 'error', message: 'Clue needs at least 3 players.' });
  }
  if (players.length > 6) {
    issues.push({ level: 'error', message: 'Clue supports at most 6 players.' });
  }
  const selfCount = players.filter((p) => p.isSelf).length;
  if (selfCount !== 1) {
    issues.push({ level: 'error', message: 'Mark exactly one player as you.' });
  }
  const unassigned = players.filter((p) => !p.suspect);
  if (unassigned.length > 0) {
    issues.push({
      level: 'error',
      message: `Assign a suspect to ${unassigned.map((p) => p.name).join(', ')}.`,
    });
  }
  const suspects = players.map((p) => p.suspect).filter(Boolean);
  if (new Set(suspects).size !== suspects.length) {
    issues.push({ level: 'error', message: 'Two players can’t play the same suspect.' });
  }

  const handSum = players.reduce((acc, p) => acc + p.handSize, 0);
  const total = 3 + handSum + game.potSize;
  if (total !== 21) {
    issues.push({
      level: 'error',
      message: `Card math is off: 3 (solution) + ${handSum} (hands) + ${game.potSize} (pot) = ${total}, but the deck has 21 cards.`,
    });
  }
  if (game.potCards.length !== game.potSize) {
    issues.push({
      level: 'error',
      message: `You tapped ${game.potCards.length} pot card${game.potCards.length === 1 ? '' : 's'} but the pot size is ${game.potSize}.`,
    });
  }
  const selfPlayer = players.find((p) => p.isSelf);
  if (selfPlayer && game.yourHand.length !== selfPlayer.handSize) {
    issues.push({
      level: 'error',
      message: `You tapped ${game.yourHand.length} hand card${game.yourHand.length === 1 ? '' : 's'} but your hand size is ${selfPlayer.handSize}.`,
    });
  }
  const overlap = game.yourHand.filter((c) => game.potCards.includes(c));
  if (overlap.length > 0) {
    issues.push({
      level: 'error',
      message: 'A card can’t be both in the pot and in your hand.',
    });
  }
  return issues;
}

/** Default even deal of the 18 non-solution cards; remainder goes to the pot. */
export function defaultDeal(playerCount: number): { handSize: number; potSize: number } {
  if (playerCount <= 0) return { handSize: 0, potSize: 18 };
  const handSize = Math.floor(18 / playerCount);
  return { handSize, potSize: 18 - handSize * playerCount };
}
