import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getGame, useStore } from '../../store/store';
import { ALL_CARDS, SUSPECTS, SUSPECT_COLORS, type SuspectId } from '../../domain/cards';
import { validateSetup } from '../../domain/validate';
import { CardTile, Chip, SectionPanel, Stepper } from '../components';

export default function Setup() {
  const { id } = useParams();
  const navigate = useNavigate();
  const game = useStore((s) => getGame(s, id));
  const roster = useStore((s) => s.roster);
  const store = useStore();
  const [newName, setNewName] = useState('');

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
  if (game.status !== 'setup') {
    navigate(game.status === 'in_progress' ? `/game/${game.id}` : `/review/${game.id}`, {
      replace: true,
    });
    return null;
  }

  const selectedIds = game.players.map((p) => p.id);
  const issues = validateSetup(game);
  const handSum = game.players.reduce((a, p) => a + p.handSize, 0);
  const total = 3 + handSum + game.potSize;
  const self = game.players.find((p) => p.isSelf);

  const addNew = (e: FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const player = store.addRosterPlayer(name);
    if (!selectedIds.includes(player.id) && game.players.length < 6) {
      store.setGamePlayers(game.id, [...selectedIds, player.id]);
    }
    setNewName('');
  };

  const togglePlayer = (rid: string) => {
    if (selectedIds.includes(rid)) {
      store.setGamePlayers(game.id, selectedIds.filter((x) => x !== rid));
    } else if (game.players.length < 6) {
      store.setGamePlayers(game.id, [...selectedIds, rid]);
    }
  };

  return (
    <div>
      <SectionPanel
        label="1 · Who's playing"
        extra={`${game.players.length} of 6 · tap to add`}
      >
        <div className="chip-row">
          {roster.map((r) => (
            <Chip
              key={r.id}
              label={r.name}
              color={r.color}
              selected={selectedIds.includes(r.id)}
              disabled={!selectedIds.includes(r.id) && game.players.length >= 6}
              onClick={() => togglePlayer(r.id)}
            />
          ))}
        </div>
        <form className="add-form" onSubmit={addNew}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Add a new player…"
            aria-label="New player name"
            maxLength={24}
          />
          <button type="submit" className="btn" disabled={!newName.trim()}>
            Add
          </button>
        </form>
        {game.players.length > 0 && (
          <>
            <p className="hint" style={{ marginTop: 14 }}>
              Seating order, clockwise from any seat. Mark which one is you.
            </p>
            {game.players.map((p, i) => (
              <div key={p.id} className="seat-row">
                <span className="seat-name">
                  <span className="mini-dot" style={{ background: p.color }} />
                  <span className="nm">
                    {i + 1}. {p.name}
                  </span>
                </span>
                <button
                  type="button"
                  className={'you-toggle' + (p.isSelf ? ' on' : '')}
                  onClick={() => store.setSelf(game.id, p.id)}
                  aria-pressed={p.isSelf}
                >
                  {p.isSelf ? '★ YOU' : 'you?'}
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Move ${p.name} up`}
                  disabled={i === 0}
                  onClick={() => store.moveSeat(game.id, p.id, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Move ${p.name} down`}
                  disabled={i === game.players.length - 1}
                  onClick={() => store.moveSeat(game.id, p.id, 1)}
                >
                  ↓
                </button>
              </div>
            ))}
          </>
        )}
      </SectionPanel>

      {game.players.length > 0 && (
        <SectionPanel label="2 · Suspects" extra="who plays whom">
          {game.players.map((p) => (
            <div key={p.id} style={{ marginBottom: 8 }}>
              <div className="seat-name" style={{ marginBottom: 2 }}>
                <span className="mini-dot" style={{ background: p.color }} />
                <span className="nm">{p.name}</span>
              </div>
              <div className="suspect-pick">
                {SUSPECTS.map((s) => {
                  const takenBy = game.players.find((q) => q.suspect === s.id);
                  const mine = p.suspect === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={
                        'spick' + (mine ? ' mine' : takenBy ? ' taken' : '')
                      }
                      onClick={() =>
                        store.setSuspect(game.id, p.id, mine ? null : (s.id as SuspectId))
                      }
                      aria-pressed={mine}
                    >
                      <span
                        className="sdot"
                        style={{ background: SUSPECT_COLORS[s.id as SuspectId] }}
                      />
                      {s.short}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </SectionPanel>
      )}

      {game.players.length > 0 && (
        <SectionPanel label="3 · The deal" extra="18 cards to share">
          {game.players.map((p) => (
            <div key={p.id} className="seat-row">
              <span className="seat-name">
                <span className="mini-dot" style={{ background: p.color }} />
                <span className="nm">
                  {p.name}
                  {p.isSelf ? ' (you)' : ''}
                </span>
              </span>
              <Stepper
                value={p.handSize}
                onChange={(v) => store.setHandSize(game.id, p.id, v)}
                label={`${p.name}'s hand size`}
              />
            </div>
          ))}
          <div className="seat-row">
            <span className="seat-name">
              <span className="nm">Face-up pot</span>
            </span>
            <Stepper
              value={game.potSize}
              onChange={(v) => store.setPotSize(game.id, v)}
              label="Pot size"
            />
          </div>
          <div className={'math-line' + (total !== 21 ? ' bad' : '')} aria-live="polite">
            3 solution + {handSum} in hands + {game.potSize} pot = {total} / 21
            {total !== 21 ? ' — check the deal' : ' ✓'}
          </div>
          <button
            type="button"
            className="btn btn-quiet btn-small"
            style={{ marginTop: 8 }}
            onClick={() => store.resetDeal(game.id)}
          >
            Reset to even deal
          </button>
        </SectionPanel>
      )}

      {game.potSize > 0 && (
        <SectionPanel
          label="4 · Pot cards"
          extra={`${game.potCards.length} of ${game.potSize} tapped`}
        >
          <p className="hint">The pot is face-up on the table — tap exactly what you see.</p>
          <div className="tile-grid">
            {ALL_CARDS.map((c) => (
              <CardTile
                key={c.id}
                card={c}
                selected={game.potCards.includes(c.id)}
                disabled={
                  !game.potCards.includes(c.id) && game.potCards.length >= game.potSize
                }
                onClick={() => store.togglePotCard(game.id, c.id)}
              />
            ))}
          </div>
        </SectionPanel>
      )}

      {self && (
        <SectionPanel
          label={`${game.potSize > 0 ? 5 : 4} · Your hand`}
          extra={`${game.yourHand.length} of ${self.handSize} tapped`}
        >
          <p className="hint">Tap the cards you were dealt. Pot cards are greyed out.</p>
          <div className="tile-grid">
            {ALL_CARDS.map((c) => (
              <CardTile
                key={c.id}
                card={c}
                selected={game.yourHand.includes(c.id)}
                disabled={
                  game.potCards.includes(c.id) ||
                  (!game.yourHand.includes(c.id) && game.yourHand.length >= self.handSize)
                }
                onClick={() => store.toggleHandCard(game.id, c.id)}
              />
            ))}
          </div>
        </SectionPanel>
      )}

      {issues.length > 0 && game.players.length > 0 && (
        <div className="banner banner-error" role="alert">
          {issues.map((i, k) => (
            <div key={k}>• {i.message}</div>
          ))}
        </div>
      )}

      <div className="actionbar">
        <button type="button" className="btn" onClick={() => navigate('/')}>
          Later
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={issues.length > 0}
          onClick={() => {
            store.startGame(game.id);
            navigate(`/game/${game.id}`);
          }}
        >
          Open the case
        </button>
      </div>
    </div>
  );
}
