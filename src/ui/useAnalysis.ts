import { useMemo } from 'react';
import type { Game } from '../domain/types';
import { analyzeGame, type Analysis } from '../domain/derive';
import { useStore } from '../store/store';

/** Memoized full analysis; recomputes only when the game mutates or settings change. */
export function useAnalysis(game: Game | undefined): Analysis | undefined {
  const settings = useStore((s) => s.settings);
  return useMemo(() => {
    if (!game || game.players.length === 0) return undefined;
    return analyzeGame(game, settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.id, game?.rev, settings]);
}
