import { useNavigate, useParams } from 'react-router-dom';
import { getGame, useStore } from '../../store/store';
import { useAnalysis } from '../useAnalysis';
import { CARD_BY_ID, CATEGORIES, cardName } from '../../domain/cards';
import { formatDateTime, formatDuration } from '../../domain/dates';
import { SectionPanel, Stamp } from '../components';
import { DeductionGrid } from '../DeductionGrid';
import { Timeline } from '../Timeline';

export default function Review() {
  const { id } = useParams();
  const navigate = useNavigate();
  const game = useStore((s) => getGame(s, id));
  const analysis = useAnalysis(game);

  if (!game) {
    return (
      <div className="panel empty-state">
        <p>Case not found.</p>
        <button type="button" className="btn" onClick={() => navigate('/')}>
          Back to case files
        </button>
      </div>
    );
  }

  const winner = game.players.find((p) => p.id === game.winnerId);
  const solved = CATEGORIES.filter((c) => game.solution[c]);

  return (
    <div>
      <SectionPanel
        label="Outcome"
        extra={game.status === 'completed' ? 'case closed' : game.status.replace('_', ' ')}
      >
        {winner ? (
          <div className="solution-stamps">
            <Stamp>Solved by {winner.name}</Stamp>
            {game.solution.suspect && (
              <strong style={{ fontSize: 16 }}>
                {cardName(game.solution.suspect)} · {game.solution.weapon && cardName(game.solution.weapon)} ·{' '}
                {game.solution.room && cardName(game.solution.room)}
              </strong>
            )}
          </div>
        ) : solved.length > 0 ? (
          <p className="hint">
            Deduced so far:{' '}
            <strong>{solved.map((c) => cardName(game.solution[c]!)).join(' · ')}</strong>
          </p>
        ) : (
          <p className="hint">No solution was confirmed in this game.</p>
        )}
        <div className="kv">
          <span className="k">Started</span>
          <span className="v">{formatDateTime(game.createdAt)}</span>
        </div>
        {game.endedAt && (
          <>
            <div className="kv">
              <span className="k">Ended</span>
              <span className="v">{formatDateTime(game.endedAt)}</span>
            </div>
            <div className="kv">
              <span className="k">Length</span>
              <span className="v">{formatDuration(game.createdAt, game.endedAt)}</span>
            </div>
          </>
        )}
        <div className="kv">
          <span className="k">Entries logged</span>
          <span className="v">{game.events.length}</span>
        </div>
      </SectionPanel>

      <SectionPanel label="The table">
        {game.players.map((p, i) => (
          <div key={p.id} className="kv">
            <span className="k">
              <span className="mini-dot" style={{ background: p.color, marginRight: 8 }} />
              {i + 1}. {p.name}
              {p.isSelf ? ' (you)' : ''}
              {p.eliminated ? ' — eliminated' : ''}
              {game.winnerId === p.id ? ' 🏆' : ''}
            </span>
            <span className="v">
              {p.suspect ? CARD_BY_ID[p.suspect].name : '—'} · {p.handSize} cards
            </span>
          </div>
        ))}
        {game.potCards.length > 0 && (
          <div className="kv">
            <span className="k">Pot (face-up)</span>
            <span className="v">{game.potCards.map((c) => cardName(c)).join(', ')}</span>
          </div>
        )}
        {game.yourHand.length > 0 && (
          <div className="kv">
            <span className="k">Your hand</span>
            <span className="v">{game.yourHand.map((c) => cardName(c)).join(', ')}</span>
          </div>
        )}
      </SectionPanel>

      <SectionPanel label="Full case log" extra={`${game.events.length} entries`}>
        <Timeline game={game} />
      </SectionPanel>

      {analysis && (
        <SectionPanel label="Final deduction grid">
          <DeductionGrid game={game} analysis={analysis} />
        </SectionPanel>
      )}

      <button type="button" className="btn btn-block" onClick={() => navigate('/')}>
        Back to case files
      </button>
    </div>
  );
}
