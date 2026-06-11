import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getGame, useStore } from '../../store/store';
import { useAnalysis } from '../useAnalysis';
import {
  CARDS_BY_CATEGORY,
  CATEGORIES,
  cardName,
  type Category,
  type RoomId,
} from '../../domain/cards';
import { secretPassageFrom } from '../../domain/board';
import type { Game } from '../../domain/types';
import type { Analysis } from '../../domain/derive';
import { Confirm, ProbBar, SectionPanel, Stamp, pct } from '../components';
import { DeductionGrid } from '../DeductionGrid';
import { Timeline } from '../Timeline';
import { SuggestSheet } from '../live/SuggestSheet';
import { AccuseSheet } from '../live/AccuseSheet';
import { MoveSheet } from '../live/MoveSheet';

const CAT_LABELS: Record<Category, string> = {
  suspect: 'Suspect',
  weapon: 'Weapon',
  room: 'Room',
};

function EnvelopePanel(props: { game: Game; analysis: Analysis }) {
  const { game, analysis } = props;
  // Animate the stamp only when a category newly resolves.
  const seenRef = useRef<Record<string, string>>({});
  const newlyStamped: Record<string, boolean> = {};
  for (const cat of CATEGORIES) {
    const proven = analysis.solution[cat];
    const key = `${game.id}:${cat}`;
    newlyStamped[cat] = proven != null && seenRef.current[key] !== proven;
  }
  useEffect(() => {
    for (const cat of CATEGORIES) {
      const proven = analysis.solution[cat];
      const key = `${game.id}:${cat}`;
      if (proven) seenRef.current[key] = proven;
      else delete seenRef.current[key];
    }
  });

  return (
    <SectionPanel
      label="The envelope"
      extra={
        analysis.sample.lowConfidence
          ? 'odds unavailable — check entries'
          : `odds from ${analysis.sample.accepted.toLocaleString()} consistent deals`
      }
    >
      {CATEGORIES.map((cat) => {
        const proven = analysis.solution[cat];
        if (proven) {
          return (
            <div key={cat} className="envelope-slot">
              <div className="envelope-cat">{CAT_LABELS[cat]}</div>
              <Stamp animate={newlyStamped[cat]}>{cardName(proven)}</Stamp>
            </div>
          );
        }
        const rows = CARDS_BY_CATEGORY[cat]
          .map((c) => ({ card: c, p: analysis.sample.envelopeProb[c.id] }))
          .sort((a, b) => b.p - a.p);
        return (
          <div key={cat} className="envelope-slot">
            <div className="envelope-cat">{CAT_LABELS[cat]}</div>
            {rows.map(({ card, p }) => (
              <ProbBar key={card.id} label={card.short} value={p} faded={p === 0} />
            ))}
          </div>
        );
      })}
    </SectionPanel>
  );
}

export default function Live() {
  const { id } = useParams();
  const navigate = useNavigate();
  const game = useStore((s) => getGame(s, id));
  const store = useStore();
  const analysis = useAnalysis(game);
  const [sheet, setSheet] = useState<'suggest' | 'accuse' | 'accuse-now' | 'move' | null>(null);
  const [moveTarget, setMoveTarget] = useState<RoomId | undefined>(undefined);
  const [confirmAbandon, setConfirmAbandon] = useState(false);

  useEffect(() => {
    if (game && game.status !== 'in_progress') {
      navigate(
        game.status === 'setup' ? `/setup/${game.id}` : `/review/${game.id}`,
        { replace: true },
      );
    }
  }, [game?.status]);

  if (!game || !analysis) {
    return (
      <div className="panel empty-state">
        <p>Case not found.</p>
        <button type="button" className="btn" onClick={() => navigate('/')}>
          Back to case files
        </button>
      </div>
    );
  }
  if (game.status !== 'in_progress') return null;

  const current = game.players[game.cursor.seatIndex];
  const isMyTurn = !!current?.isSelf;
  const self = game.players.find((p) => p.isSelf)!;
  const selfLoc = analysis.locations[self.id];
  const currentRoom = selfLoc.location.kind === 'room' ? selfLoc.location.room : undefined;
  const passageTo = currentRoom ? secretPassageFrom(currentRoom) : undefined;
  const lastEvent = game.events[game.events.length - 1];
  // Undo is turn-scoped: step back to an entry's turn before removing it.
  const canUndo = lastEvent != null && lastEvent.turn === game.cursor.turn;

  // One move, one suggestion, one accusation per turn; advance with ▶.
  const turnEvents = game.events.filter((e) => e.turn === game.cursor.turn);
  const currentEliminated = current ? analysis.eliminated[current.id] : false;
  const moveLogged = currentEliminated || turnEvents.some((e) => e.type === 'movement');
  const suggestionLogged = currentEliminated || turnEvents.some((e) => e.type === 'suggestion');
  const accusationLogged = currentEliminated || turnEvents.some((e) => e.type === 'accusation');

  return (
    <div>
      <div className="turnbar">
        <button
          type="button"
          className="turn-btn"
          aria-label="Previous turn"
          disabled={game.cursor.turn <= 1}
          onClick={() => store.prevTurn(game.id)}
        >
          ◀
        </button>
        <span className="turn-num">TURN {game.cursor.turn}</span>
        <span className={'turn-player' + (current?.isSelf ? ' turn-you' : '')}>
          {current ? (current.isSelf ? `${current.name} — your move` : current.name) : '—'}
        </span>
        <button
          type="button"
          className="turn-btn"
          aria-label="Next turn"
          onClick={() => store.nextTurn(game.id)}
        >
          ▶
        </button>
      </div>

      {analysis.contradictions.length > 0 && (
        <div className="banner banner-error" role="alert">
          <strong>The notes contradict themselves.</strong>
          {analysis.contradictions.slice(0, 3).map((c, i) => (
            <div key={i}>• {c}</div>
          ))}
          {lastEvent && canUndo ? (
            <button
              type="button"
              className="btn btn-small btn-danger"
              style={{ marginTop: 8 }}
              onClick={() => store.undoLast(game.id)}
            >
              Undo last entry
            </button>
          ) : lastEvent ? (
            <div style={{ marginTop: 6 }}>
              Step back to turn {lastEvent.turn} with ◀ to undo the latest entry.
            </div>
          ) : null}
        </div>
      )}

      {analysis.accuseNow && !self.eliminated && (
        <div className="banner banner-accuse">
          <div className="solution-stamps">
            <Stamp small>Case solved</Stamp>
            <strong style={{ fontSize: 17 }}>
              {cardName(analysis.accuseNow.suspect)} · {cardName(analysis.accuseNow.weapon)} ·{' '}
              {cardName(analysis.accuseNow.room)}
            </strong>
          </div>
          <p className="hint">
            All three categories are proven.{' '}
            {isMyTurn ? 'Accuse now.' : 'Step to your turn, then accuse.'}
          </p>
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={!isMyTurn || accusationLogged}
            onClick={() => setSheet('accuse-now')}
          >
            Make your accusation
          </button>
        </div>
      )}

      {self.eliminated && (
        <div className="banner banner-warn">
          You’re eliminated — keep logging events; your cards still disprove and the solver
          keeps working.
        </div>
      )}

      <EnvelopePanel game={game} analysis={analysis} />

      {isMyTurn && !analysis.accuseNow && analysis.recommendations.length > 0 && (
        <SectionPanel label="Recommended next move">
          {analysis.recommendations.map((rec, i) => (
            <div key={`${rec.room}`} className={'rec' + (i === 0 ? ' rec-best' : '')}>
              <div className="rec-head">
                <span>
                  Go to the {cardName(rec.room)}
                  {rec.viaSecretPassage ? ' (secret passage)' : ''}
                </span>
                <span className="rec-reach">reach {pct(rec.reach)}</span>
              </div>
              <div className="rec-body">
                Suggest {cardName(rec.suspect)} · {cardName(rec.weapon)} ·{' '}
                {cardName(rec.room)}
              </div>
              <div className="rec-note">{rec.note}</div>
            </div>
          ))}
        </SectionPanel>
      )}

      {isMyTurn && (
      <SectionPanel
        label="Your position"
        extra={
          selfLoc.location.kind === 'room'
            ? `${cardName(selfLoc.location.room)}${selfLoc.eligibleToSuggest ? '' : ' · already suggested here'}`
            : 'hallway'
        }
      >
        {currentRoom && !selfLoc.eligibleToSuggest && (
          <p className="hint">
            You’ve used this room’s suggestion — leave and re-enter (or get summoned) to
            suggest here again.
          </p>
        )}
        {passageTo && (
          <p className="hint">
            Secret passage available: {cardName(currentRoom!)} → {cardName(passageTo)}.
          </p>
        )}
        <div className="room-grid">
          {CARDS_BY_CATEGORY.room.map((c) => {
            const r = c.id as RoomId;
            return (
              <button
                key={r}
                type="button"
                className={'room-tile' + (currentRoom === r ? ' here' : '')}
                disabled={moveLogged}
                onClick={() => {
                  setMoveTarget(r);
                  setSheet('move');
                }}
              >
                <span className="room-name">{c.name}</span>
                <span className="room-reach">
                  {currentRoom === r && selfLoc.eligibleToSuggest
                    ? 'suggest here'
                    : `reach ${pct(analysis.reach[r])}`}
                </span>
              </button>
            );
          })}
        </div>
        <p className="fine" style={{ marginTop: 8 }}>
          {moveLogged
            ? 'Move logged for this turn — advance with ▶ when the turn is done.'
            : 'Reach = odds of entering on a 2d6 roll this turn. Tap a room when you’ve moved.'}
        </p>
      </SectionPanel>
      )}

      <SectionPanel label="Deduction grid">
        <DeductionGrid game={game} analysis={analysis} />
      </SectionPanel>

      <SectionPanel label="Case log" extra={`${game.events.length} entries`}>
        <Timeline
          game={game}
          reverse
          limit={12}
          onUndo={canUndo ? () => store.undoLast(game.id) : undefined}
        />
        <button
          type="button"
          className="btn btn-quiet btn-small"
          style={{ marginTop: 10 }}
          onClick={() => setConfirmAbandon(true)}
        >
          Abandon this game…
        </button>
      </SectionPanel>

      <div className="actionbar">
        <button
          type="button"
          className="btn"
          disabled={moveLogged}
          onClick={() => setSheet('move')}
        >
          Move
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={suggestionLogged}
          onClick={() => setSheet('suggest')}
          style={{ flex: 1.6 }}
        >
          Suggestion
        </button>
        <button
          type="button"
          className="btn"
          disabled={accusationLogged}
          onClick={() => setSheet('accuse')}
        >
          Accuse
        </button>
      </div>

      <SuggestSheet
        game={game}
        analysis={analysis}
        open={sheet === 'suggest'}
        onClose={() => setSheet(null)}
      />
      <AccuseSheet
        game={game}
        analysis={analysis}
        open={sheet === 'accuse' || sheet === 'accuse-now'}
        initial={sheet === 'accuse-now' ? analysis.accuseNow : undefined}
        onClose={() => setSheet(null)}
      />
      <MoveSheet
        game={game}
        analysis={analysis}
        open={sheet === 'move'}
        initialRoom={moveTarget}
        onClose={() => {
          setSheet(null);
          setMoveTarget(undefined);
        }}
      />
      <Confirm
        open={confirmAbandon}
        title="Abandon this game?"
        body="The game moves to your history as abandoned. The log is kept; the solver stops."
        confirmLabel="Abandon"
        danger
        onConfirm={() => {
          store.abandonGame(game.id);
          navigate(`/review/${game.id}`);
        }}
        onClose={() => setConfirmAbandon(false)}
      />
    </div>
  );
}
