import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import { groupByBucket, formatDateTime } from '../../domain/dates';
import type { Game } from '../../domain/types';
import { Confirm } from '../components';

const STATUS_LABELS: Record<Game['status'], string> = {
  setup: 'Setting up',
  in_progress: 'In progress',
  completed: 'Closed',
  abandoned: 'Abandoned',
};

function routeFor(game: Game): string {
  if (game.status === 'setup') return `/setup/${game.id}`;
  if (game.status === 'in_progress') return `/game/${game.id}`;
  return `/review/${game.id}`;
}

export default function Home() {
  const games = useStore((s) => s.games);
  const createGame = useStore((s) => s.createGame);
  const deleteGame = useStore((s) => s.deleteGame);
  const navigate = useNavigate();
  const [toDelete, setToDelete] = useState<Game | null>(null);

  const groups = groupByBucket(games, (g) => g.createdAt);

  return (
    <div>
      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={() => navigate(`/setup/${createGame()}`)}
      >
        + Open a new case
      </button>

      {games.length === 0 && (
        <div className="panel empty-state" style={{ marginTop: 16 }}>
          <p>
            No cases on file yet. Start a new game at the table and this becomes your
            casebook: every suggestion, every shown card, every deduction.
          </p>
        </div>
      )}

      {groups.map((group) => (
        <section key={group.bucket}>
          <h2 className="bucket-label">{group.label}</h2>
          {group.items.map((game) => {
            const winner = game.players.find((p) => p.id === game.winnerId);
            return (
              <div key={game.id} className="game-row">
                <button
                  type="button"
                  className="game-row-main"
                  onClick={() => navigate(routeFor(game))}
                  style={{ background: 'none', border: 'none', padding: 0 }}
                >
                  <div className="game-row-date">{formatDateTime(game.createdAt)}</div>
                  <div className="game-row-meta">
                    {game.players.map((p) => (
                      <span
                        key={p.id}
                        className="mini-dot"
                        style={{ background: p.color }}
                        title={p.name}
                      />
                    ))}
                    {game.players.length > 0 && (
                      <span style={{ marginLeft: 6 }}>
                        {game.players.map((p) => p.name).join(', ')}
                      </span>
                    )}
                    {winner && <span className="winner-tag">🏆 {winner.name}</span>}
                  </div>
                </button>
                <span className={`badge badge-${game.status}`}>{STATUS_LABELS[game.status]}</span>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Delete game from ${formatDateTime(game.createdAt)}`}
                  onClick={() => setToDelete(game)}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </section>
      ))}

      <Confirm
        open={toDelete != null}
        title="Delete this case?"
        body={
          toDelete
            ? `This permanently removes the game from ${formatDateTime(toDelete.createdAt)} and all its records. There is no undo.`
            : ''
        }
        confirmLabel="Delete forever"
        danger
        onConfirm={() => toDelete && deleteGame(toDelete.id)}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
