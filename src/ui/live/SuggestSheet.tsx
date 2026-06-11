import { useEffect, useState } from 'react';
import type { Game } from '../../domain/types';
import type { Analysis } from '../../domain/derive';
import { askOrder } from '../../domain/derive';
import {
  CARD_BY_ID,
  ROOM_CARDS,
  SUSPECTS,
  WEAPONS,
  cardName,
  type CardId,
  type RoomId,
  type SuspectId,
  type WeaponId,
} from '../../domain/cards';
import { useStore } from '../../store/store';
import { CardTile, Chip, Crumbs, Sheet, pct } from '../components';

interface DraftState {
  step: number;
  suggesterId: string | null;
  suspect: SuspectId | null;
  weapon: WeaponId | null;
  room: RoomId | null;
  outcome: 'none' | string | null; // string = disprover player id
  shownCard: CardId | null;
}

const FRESH: DraftState = {
  step: 0,
  suggesterId: null,
  suspect: null,
  weapon: null,
  room: null,
  outcome: null,
  shownCard: null,
};

export function SuggestSheet(props: {
  game: Game;
  analysis: Analysis;
  open: boolean;
  onClose: () => void;
}) {
  const { game, analysis } = props;
  const logSuggestion = useStore((s) => s.logSuggestion);
  const [d, setD] = useState<DraftState>(FRESH);

  const currentPlayer = game.players[game.cursor.seatIndex];
  useEffect(() => {
    if (props.open) {
      // Turn-by-turn: the suggester is always whoever's turn it is.
      setD({ ...FRESH, suggesterId: currentPlayer?.id ?? null, step: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open]);

  const selfId = game.players.find((p) => p.isSelf)?.id;
  const suggester = game.players.find((p) => p.id === d.suggesterId);
  const named: CardId[] =
    d.suspect && d.weapon && d.room ? [d.suspect, d.weapon, d.room] : [];

  // Who needs a "which card" step?
  const youSuggested = d.suggesterId === selfId;
  const youDisproved = d.outcome != null && d.outcome !== 'none' && d.outcome === selfId;
  const needsShownStep =
    d.outcome != null && d.outcome !== 'none' && (youSuggested || youDisproved);
  const shownOptions: CardId[] = youSuggested
    ? named
    : named.filter((c) => game.yourHand.includes(c));

  const stepLabels = [
    suggester ? suggester.name : 'Who',
    d.suspect ? CARD_BY_ID[d.suspect].short : 'Suspect',
    d.weapon ? CARD_BY_ID[d.weapon].short : 'Weapon',
    d.room ? CARD_BY_ID[d.room].short : 'Room',
    d.outcome == null
      ? 'Outcome'
      : d.outcome === 'none'
        ? 'No one'
        : (game.players.find((p) => p.id === d.outcome)?.name ?? '?'),
    ...(needsShownStep ? [d.shownCard ? CARD_BY_ID[d.shownCard].short : 'Card'] : []),
  ];

  const confirmStep = needsShownStep ? 6 : 5;
  const canSave =
    d.suggesterId != null &&
    d.suspect != null &&
    d.weapon != null &&
    d.room != null &&
    d.outcome != null &&
    (!needsShownStep || d.shownCard != null);

  const save = () => {
    if (!canSave) return;
    logSuggestion(game.id, {
      suggesterId: d.suggesterId!,
      cards: { suspect: d.suspect!, weapon: d.weapon!, room: d.room! },
      outcome:
        d.outcome === 'none'
          ? { kind: 'none' }
          : { kind: 'disproved', byId: d.outcome!, shownCard: d.shownCard ?? undefined },
    });
    props.onClose();
  };

  const order = d.suggesterId ? askOrder(game.players.map((p) => p.id), d.suggesterId) : [];

  return (
    <Sheet open={props.open} title="Log a suggestion" onClose={props.onClose}>
      <Crumbs
        items={stepLabels.map((label, i) => ({
          label,
          state: i === d.step ? 'active' : i < d.step ? 'done' : 'todo',
          // The first crumb is the current-turn player — fixed, not a step.
          onClick: i > 0 && i < d.step ? () => setD({ ...d, step: i }) : undefined,
        }))}
      />

      {d.step === 1 && (
        <>
          <p className="step-q">Which suspect was named?</p>
          <div className="tile-grid">
            {SUSPECTS.map((c) => (
              <CardTile
                key={c.id}
                card={c}
                selected={d.suspect === c.id}
                onClick={() =>
                  setD({
                    ...d,
                    suspect: c.id as SuspectId,
                    outcome: null,
                    shownCard: null,
                    step: 2,
                  })
                }
              />
            ))}
          </div>
        </>
      )}

      {d.step === 2 && (
        <>
          <p className="step-q">Which weapon?</p>
          <div className="tile-grid">
            {WEAPONS.map((c) => (
              <CardTile
                key={c.id}
                card={c}
                selected={d.weapon === c.id}
                onClick={() =>
                  setD({
                    ...d,
                    weapon: c.id as WeaponId,
                    outcome: null,
                    shownCard: null,
                    step: 3,
                  })
                }
              />
            ))}
          </div>
        </>
      )}

      {d.step === 3 && (
        <>
          <p className="step-q">
            Which room? {youSuggested ? 'You must be in it.' : 'The suggester moves there.'}
          </p>
          <div className="tile-grid">
            {ROOM_CARDS.map((c) => (
              <CardTile
                key={c.id}
                card={c}
                selected={d.room === c.id}
                sub={youSuggested ? `reach ${pct(analysis.reach[c.id as RoomId])}` : undefined}
                onClick={() =>
                  setD({
                    ...d,
                    room: c.id as RoomId,
                    outcome: null,
                    shownCard: null,
                    step: 4,
                  })
                }
              />
            ))}
          </div>
        </>
      )}

      {d.step === 4 && (
        <>
          <p className="step-q">Who disproved it?</p>
          <div className="chip-row">
            {order.map((pid) => {
              const p = game.players.find((q) => q.id === pid)!;
              return (
                <Chip
                  key={pid}
                  label={p.isSelf ? `${p.name} (you)` : p.name}
                  color={p.color}
                  selected={d.outcome === pid}
                  onClick={() => {
                    const youDis = pid === selfId;
                    const opts = youDis
                      ? named.filter((c) => game.yourHand.includes(c))
                      : [];
                    // Only one card you could have shown? Skip straight to confirm.
                    const auto = youDis && opts.length === 1 ? opts[0] : null;
                    setD({
                      ...d,
                      outcome: pid,
                      shownCard: auto,
                      step: auto ? 6 : 5,
                    });
                  }}
                />
              );
            })}
          </div>
          <p className="hint" style={{ marginTop: 10 }}>
            Asked in table order. Eliminated players still show cards.
          </p>
          <button
            type="button"
            className="btn btn-block"
            style={{ marginTop: 6 }}
            onClick={() => setD({ ...d, outcome: 'none', shownCard: null, step: 5 })}
          >
            No one could disprove
          </button>
        </>
      )}

      {d.step === 5 && needsShownStep && (
        <>
          <p className="step-q">
            {youSuggested ? 'Which card were you shown?' : 'Which card did you show?'}
          </p>
          {shownOptions.length === 0 ? (
            <p className="banner banner-warn">
              You don’t hold any of the three named cards — you couldn’t have disproved this.
              Step back and check the entry.
            </p>
          ) : (
            <div className="tile-grid">
              {shownOptions.map((cid) => (
                <CardTile
                  key={cid}
                  card={CARD_BY_ID[cid]}
                  selected={d.shownCard === cid}
                  onClick={() => setD({ ...d, shownCard: cid, step: 6 })}
                />
              ))}
            </div>
          )}
        </>
      )}

      {d.step === confirmStep && (
        <>
          <p className="step-q">Confirm the entry</p>
          <p className="hint" style={{ fontSize: 14.5 }}>
            <strong>{suggester?.name}</strong> suggested{' '}
            <strong>
              {d.suspect && cardName(d.suspect)} · {d.weapon && cardName(d.weapon)} ·{' '}
              {d.room && cardName(d.room)}
            </strong>
            {d.outcome === 'none' ? (
              <> — no one could disprove.</>
            ) : (
              <>
                {' '}
                — disproved by{' '}
                <strong>{game.players.find((p) => p.id === d.outcome)?.name}</strong>
                {d.shownCard ? (
                  <>
                    , {youSuggested ? 'showing you' : 'you showed'}{' '}
                    <strong>{cardName(d.shownCard)}</strong>
                  </>
                ) : (
                  <> (card unseen)</>
                )}
                .
              </>
            )}
          </p>
          <div className="sheet-actions">
            <button type="button" className="btn" onClick={props.onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canSave}
              onClick={save}
            >
              Save entry
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
