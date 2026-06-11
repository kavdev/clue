import { Fragment } from 'react';
import type { Game } from '../domain/types';
import { ENVELOPE, POT } from '../domain/types';
import type { Analysis } from '../domain/derive';
import { CARDS_BY_CATEGORY, CATEGORIES } from '../domain/cards';
import { pct } from './components';

const CAT_LABELS: Record<string, string> = {
  suspect: 'Suspects',
  weapon: 'Weapons',
  room: 'Rooms',
};

export function DeductionGrid(props: { game: Game; analysis: Analysis }) {
  const { game, analysis } = props;
  const { marks } = analysis.solver;
  const handSet = new Set(game.yourHand);
  const colCount = game.players.length + 3;

  return (
    <div className="grid-scroll">
      <table className="dgrid">
        <thead>
          <tr>
            <th className="cardcol" scope="col">
              Card
            </th>
            {game.players.map((p) => (
              <th key={p.id} scope="col">
                <span
                  className={
                    'colchip' +
                    (p.isSelf ? ' you' : '') +
                    (analysis.eliminated[p.id] ? ' elim' : '')
                  }
                >
                  <span className="dot" style={{ background: p.color }} />
                  <span className="nm">{p.isSelf ? 'You' : p.name}</span>
                </span>
              </th>
            ))}
            <th scope="col">
              <span className="colchip">
                <span className="nm">Pot</span>
              </span>
            </th>
            <th scope="col">
              <span className="colchip">
                <span className="nm">Env.</span>
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {CATEGORIES.map((cat) => (
            <Fragment key={cat}>
              <tr className="catrow">
                <td colSpan={colCount}>{CAT_LABELS[cat]}</td>
              </tr>
              {CARDS_BY_CATEGORY[cat].map((card) => {
                const row = marks[card.id];
                const solved = row[ENVELOPE] === 'has';
                return (
                  <tr
                    key={card.id}
                    className={(handSet.has(card.id) ? 'inhand ' : '') + (solved ? 'solved' : '')}
                  >
                    <td className="cardcol">{card.short}</td>
                    {game.players.map((p) => (
                      <td
                        key={p.id}
                        className={
                          row[p.id] === 'has'
                            ? 'c-has'
                            : row[p.id] === 'hasNot'
                              ? 'c-not'
                              : 'c-unk'
                        }
                      >
                        {row[p.id] === 'has' ? '✓' : row[p.id] === 'hasNot' ? '✕' : '·'}
                      </td>
                    ))}
                    <td className={row[POT] === 'has' ? 'c-has' : 'c-not'}>
                      {row[POT] === 'has' ? '✓' : '✕'}
                    </td>
                    {row[ENVELOPE] === 'has' ? (
                      <td className="c-env-has">★</td>
                    ) : row[ENVELOPE] === 'hasNot' ? (
                      <td className="c-not">✕</td>
                    ) : (
                      <td className="c-env-pct">{pct(analysis.sample.envelopeProb[card.id])}</td>
                    )}
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
