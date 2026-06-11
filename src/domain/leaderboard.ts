/** Cross-game leaderboard (PRD §9.5): completed games only, all-time. */

import type { Game, RosterPlayer } from './types';

export interface LeaderboardRow {
  player: RosterPlayer;
  played: number;
  wins: number;
  winRate: number;
}

export function leaderboardRows(games: Game[], roster: RosterPlayer[]): LeaderboardRow[] {
  const completed = games.filter((g) => g.status === 'completed');
  const rows: LeaderboardRow[] = [];
  for (const player of roster) {
    const played = completed.filter((g) => g.players.some((p) => p.id === player.id)).length;
    if (played === 0) continue;
    const wins = completed.filter((g) => g.winnerId === player.id).length;
    rows.push({ player, played, wins, winRate: wins / played });
  }
  rows.sort(
    (a, b) =>
      b.wins - a.wins ||
      b.winRate - a.winRate ||
      b.played - a.played ||
      a.player.name.localeCompare(b.player.name),
  );
  return rows;
}
