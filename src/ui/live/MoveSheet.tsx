import { useEffect, useState } from 'react';
import type { Game } from '../../domain/types';
import type { Analysis } from '../../domain/derive';
import { ROOM_CARDS, cardName, type RoomId } from '../../domain/cards';
import { secretPassageFrom } from '../../domain/board';
import { useStore } from '../../store/store';
import { Sheet, pct } from '../components';

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
  const loc = selfId ? analysis.locations[selfId] : undefined;
  const currentRoom = loc?.location.kind === 'room' ? loc.location.room : undefined;
  const passageTo = currentRoom ? secretPassageFrom(currentRoom) : undefined;

  const [dest, setDest] = useState<RoomId | 'hallway' | null>(null);
  const [viaPassage, setViaPassage] = useState(false);

  useEffect(() => {
    if (props.open) {
      setDest(props.initialRoom ?? null);
      setViaPassage(props.initialRoom != null && props.initialRoom === passageTo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open]);

  const save = () => {
    if (!selfId || dest == null) return;
    logMovement(game.id, {
      playerId: selfId,
      to: dest === 'hallway' ? { kind: 'hallway' } : { kind: 'room', room: dest },
      arrival: dest !== 'hallway' && viaPassage && dest === passageTo ? 'secret_passage' : 'self',
    });
    props.onClose();
  };

  return (
    <Sheet open={props.open} title="Update your location" onClose={props.onClose}>
      <p className="hint">
        Where did your token end up this turn?
        {currentRoom ? ` You're in the ${cardName(currentRoom)}.` : " You're in the hallway."}
      </p>
      <div className="room-grid">
        {ROOM_CARDS.map((c) => {
          const r = c.id as RoomId;
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
              <span className="room-reach">
                {currentRoom === r ? 'here now' : `reach ${pct(analysis.reach[r])}`}
              </span>
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
            How did you get there?
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
          disabled={dest == null}
          onClick={save}
        >
          Save move
        </button>
      </div>
    </Sheet>
  );
}
