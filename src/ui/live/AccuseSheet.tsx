import { useEffect, useState } from 'react';
import type { Game, SuggestionCards } from '../../domain/types';
import type { Analysis } from '../../domain/derive';
import {
  CARD_BY_ID,
  ROOM_CARDS,
  SUSPECTS,
  WEAPONS,
  cardName,
  type RoomId,
  type SuspectId,
  type WeaponId,
} from '../../domain/cards';
import { useStore } from '../../store/store';
import { CardTile, Chip, Crumbs, Sheet } from '../components';

interface DraftState {
  step: number;
  accuserId: string | null;
  suspect: SuspectId | null;
  weapon: WeaponId | null;
  room: RoomId | null;
  success: boolean | null;
}

export function AccuseSheet(props: {
  game: Game;
  analysis: Analysis;
  open: boolean;
  onClose: () => void;
  /** Prefill (e.g. from the "make your accusation" prompt). */
  initial?: SuggestionCards;
}) {
  const { game, analysis } = props;
  const logAccusation = useStore((s) => s.logAccusation);
  const selfId = game.players.find((p) => p.isSelf)?.id ?? null;
  const [d, setD] = useState<DraftState>({
    step: 0,
    accuserId: null,
    suspect: null,
    weapon: null,
    room: null,
    success: null,
  });

  useEffect(() => {
    if (props.open) {
      setD({
        step: props.initial ? 4 : 0,
        accuserId: props.initial ? selfId : null,
        suspect: props.initial?.suspect ?? null,
        weapon: props.initial?.weapon ?? null,
        room: props.initial?.room ?? null,
        success: null,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open]);

  const accuser = game.players.find((p) => p.id === d.accuserId);
  const stepLabels = [
    accuser ? accuser.name : 'Who',
    d.suspect ? CARD_BY_ID[d.suspect].short : 'Suspect',
    d.weapon ? CARD_BY_ID[d.weapon].short : 'Weapon',
    d.room ? CARD_BY_ID[d.room].short : 'Room',
    d.success == null ? 'Verdict' : d.success ? 'Correct' : 'Wrong',
  ];
  const canSave =
    d.accuserId != null &&
    d.suspect != null &&
    d.weapon != null &&
    d.room != null &&
    d.success != null;

  const save = () => {
    if (!canSave) return;
    logAccusation(game.id, {
      accuserId: d.accuserId!,
      cards: { suspect: d.suspect!, weapon: d.weapon!, room: d.room! },
      success: d.success!,
    });
    props.onClose();
  };

  return (
    <Sheet open={props.open} title="Log an accusation" onClose={props.onClose}>
      <Crumbs
        items={stepLabels.map((label, i) => ({
          label,
          state: i === d.step ? 'active' : i < d.step ? 'done' : 'todo',
          onClick: i < d.step ? () => setD({ ...d, step: i }) : undefined,
        }))}
      />

      {d.step === 0 && (
        <>
          <p className="step-q">Who is accusing?</p>
          <div className="chip-row">
            {game.players.map((p) => (
              <Chip
                key={p.id}
                label={p.isSelf ? `${p.name} (you)` : p.name}
                color={p.color}
                selected={d.accuserId === p.id}
                disabled={analysis.eliminated[p.id]}
                eliminated={analysis.eliminated[p.id]}
                onClick={() => setD({ ...d, accuserId: p.id, step: 1 })}
              />
            ))}
          </div>
        </>
      )}

      {d.step === 1 && (
        <>
          <p className="step-q">The suspect…</p>
          <div className="tile-grid">
            {SUSPECTS.map((c) => (
              <CardTile
                key={c.id}
                card={c}
                selected={d.suspect === c.id}
                onClick={() => setD({ ...d, suspect: c.id as SuspectId, step: 2 })}
              />
            ))}
          </div>
        </>
      )}

      {d.step === 2 && (
        <>
          <p className="step-q">…with the weapon…</p>
          <div className="tile-grid">
            {WEAPONS.map((c) => (
              <CardTile
                key={c.id}
                card={c}
                selected={d.weapon === c.id}
                onClick={() => setD({ ...d, weapon: c.id as WeaponId, step: 3 })}
              />
            ))}
          </div>
        </>
      )}

      {d.step === 3 && (
        <>
          <p className="step-q">…in the room…</p>
          <div className="tile-grid">
            {ROOM_CARDS.map((c) => (
              <CardTile
                key={c.id}
                card={c}
                selected={d.room === c.id}
                onClick={() => setD({ ...d, room: c.id as RoomId, step: 4 })}
              />
            ))}
          </div>
        </>
      )}

      {d.step === 4 && (
        <>
          <p className="step-q">They checked the envelope. Were they right?</p>
          <div className="sheet-actions" style={{ marginTop: 4 }}>
            <button
              type="button"
              className={'btn' + (d.success === false ? ' btn-primary' : '')}
              onClick={() => setD({ ...d, success: false, step: 5 })}
            >
              Wrong
            </button>
            <button
              type="button"
              className={'btn' + (d.success === true ? ' btn-primary' : '')}
              onClick={() => setD({ ...d, success: true, step: 5 })}
            >
              Correct
            </button>
          </div>
        </>
      )}

      {d.step === 5 && (
        <>
          <p className="step-q">Confirm the entry</p>
          <p className="hint" style={{ fontSize: 14.5 }}>
            <strong>{accuser?.name}</strong> accused{' '}
            <strong>
              {d.suspect && cardName(d.suspect)} · {d.weapon && cardName(d.weapon)} ·{' '}
              {d.room && cardName(d.room)}
            </strong>
            {d.success ? (
              <>
                {' '}
                — <strong>correct</strong>. This closes the case and records the win.
              </>
            ) : (
              <>
                {' '}
                — <strong>wrong</strong>. {accuser?.name} is eliminated: no more turns, but
                their cards still disprove suggestions.
              </>
            )}
          </p>
          <div className="sheet-actions">
            <button type="button" className="btn" onClick={props.onClose}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" disabled={!canSave} onClick={save}>
              {d.success ? 'Close the case' : 'Save entry'}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
