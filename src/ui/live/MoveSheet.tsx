import { useEffect, useState } from 'react';
import type { Game } from '../../domain/types';
import type { Analysis } from '../../domain/derive';
import { ROOM_CARDS, cardName, type RoomId } from '../../domain/cards';
import { secretPassageFrom } from '../../domain/board';
import { useStore } from '../../store/store';
import { Chip, Sheet, pct } from '../components';

export function MoveSheet(props: {
  game: Game;
  analysis: Analysis;
  open: boolean;
  onClose: () => void;
  initialRoom?: RoomId;
}) {
  const { game, analysis } = props;
  const logMovement = useStore((s) => s.logMovement);
  const selfId = game.players.find((p) => p.isSelf)?.id;
  const current = game.players[game.cursor.seatIndex];

  const [moverId, setMoverId] = useState<string | null>(null);
  const [dest, setDest] = useState<RoomId | 'hallway' | null>(null);
  const [viaPassage, setViaPassage] = useState(false);

  const mover = game.players.find((p) => p.id === moverId);
  const moverLoc = moverId ? analysis.locations[moverId] : undefined;
  const currentRoom = moverLoc?.location.kind === 'room' ? moverLoc.location.room : undefined;
  const passageTo = currentRoom ? secretPassageFrom(currentRoom) : undefined;

  useEffect(() => {
    if (props.open) {
      // Like Suggest/Accuse, default to whoever's turn it is.
      const fallback =
        current && !analysis.eliminated[current.id] ? current.id : (selfId ?? null);
      setMoverId(fallback);
      setDest(props.initialRoom ?? null);
      const loc = fallback ? analysis.locations[fallback] : undefined;
      const passage =
        loc?.location.kind === 'room' ? secretPassageFrom(loc.location.room) : undefined;
      setViaPassage(props.initialRoom != null && props.initialRoom === passage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open]);

  const save = () => {
    if (!moverId || dest == null) return;
    logMovement(game.id, {
      playerId: moverId,
      to: dest === 'hallway' ? { kind: 'hallway' } : { kind: 'room', room: dest },
      arrival: dest !== 'hallway' && viaPassage && dest === passageTo ? 'secret_passage' : 'self',
    });
    props.onClose();
  };

  const isSelfMove = moverId === selfId;

  return (
    <Sheet open={props.open} title="Log a move" onClose={props.onClose}>
      <div className="chip-row" style={{ marginBottom: 10 }}>
        {game.players.map((p) => (
          <Chip
            key={p.id}
            label={p.isSelf ? `${p.name} (you)` : p.name}
            color={p.color}
            selected={moverId === p.id}
            disabled={analysis.eliminated[p.id]}
            eliminated={analysis.eliminated[p.id]}
            onClick={() => {
              setMoverId(p.id);
              setViaPassage(false);
            }}
          />
        ))}
      </div>
      <p className="hint">
        {isSelfMove ? 'Where did your token end up this turn?' : `Where did ${mover?.name ?? 'their'}’s token end up?`}
        {currentRoom
          ? ` ${isSelfMove ? 'You’re' : 'They’re'} in the ${cardName(currentRoom)} now.`
          : ` ${isSelfMove ? 'You’re' : 'They’re'} in the hallway now.`}
        {!isSelfMove && ' Tracking other tokens is optional — it doesn’t affect deductions.'}
      </p>
      <div className="room-grid">
        {ROOM_CARDS.map((c) => {
          const r = c.id as RoomId;
          const sub =
            currentRoom === r
              ? 'here now'
              : isSelfMove
                ? `reach ${pct(analysis.reach[r])}`
                : passageTo === r
                  ? 'via secret passage'
                  : '';
          return (
            <button
              key={r}
              type="button"
              className={
                'room-tile' +
                (dest === r ? ' selected' : '') +
                (currentRoom === r ? ' here' : '')
              }
              onClick={() => {
                setDest(r);
                setViaPassage(r === passageTo);
              }}
              aria-pressed={dest === r}
            >
              <span className="room-name">{c.name}</span>
              {sub && <span className="room-reach">{sub}</span>}
            </button>
          );
        })}
        <button
          type="button"
          className={'room-tile' + (dest === 'hallway' ? ' selected' : '')}
          onClick={() => setDest('hallway')}
          aria-pressed={dest === 'hallway'}
        >
          <span className="room-name">Hallway</span>
          <span className="room-reach">between rooms</span>
        </button>
      </div>

      {dest != null && dest !== 'hallway' && dest === passageTo && (
        <div style={{ marginTop: 12 }}>
          <p className="step-q" style={{ marginBottom: 6 }}>
            {isSelfMove ? 'How did you get there?' : 'How did they get there?'}
          </p>
          <div className="sheet-actions" style={{ marginTop: 0 }}>
            <button
              type="button"
              className={'btn' + (!viaPassage ? ' btn-primary' : '')}
              onClick={() => setViaPassage(false)}
            >
              Rolled & walked
            </button>
            <button
              type="button"
              className={'btn' + (viaPassage ? ' btn-primary' : '')}
              onClick={() => setViaPassage(true)}
            >
              Secret passage
            </button>
          </div>
        </div>
      )}

      <div className="sheet-actions">
        <button type="button" className="btn" onClick={props.onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={dest == null || moverId == null}
          onClick={save}
        >
          Save move
        </button>
      </div>
    </Sheet>
  );
}
