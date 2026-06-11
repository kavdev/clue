# Clue · Case Files

A mobile-first web app that helps one player win **Clue (Cluedo), 1998 Parker Brothers
"Classic Detective Game" edition**. It is a **logger** — recording the deal, every
suggestion, who disproved whom, accusations, and your movement — and a **solver** that
turns those records into deductions, envelope probabilities, and a recommended next move.

Everything runs client-side; all data persists to `localStorage`.

## Run it

```bash
npm install
npm run dev        # local dev server
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build
npm test           # solver acceptance tests + UI smoke tests
```

## How it works

- **Layer 1 — deterministic propagation** (`src/domain/solver.ts`): tracks
  `has / hasNot / unknown` per card per holder (players, envelope, pot) and applies
  every forcing rule to a fixpoint — card uniqueness, face-up pot knowledge, one
  envelope card per category, hand-size counting, disjunctions from unseen disproofs,
  skip deductions, no-disprove pressure, and failed-accusation exclusion. Contradictions
  surface as an undoable warning.
- **Layer 2 — Monte Carlo** (`src/domain/sampler.ts`): samples thousands of complete
  deals consistent with every known constraint to estimate P(card in envelope).
- **Recommendations** (`src/domain/recommend.ts`): ranks candidate suggestions by
  expected entropy reduction over the envelope distribution × the probability you can
  reach the room this turn (2d6 model over an editable room-distance matrix, with
  secret passages and doorway counts from the 1998 board — see `src/domain/board.ts`
  and the Board settings screen).
- **Everything is recomputed from the append-only event log**, so undo and reload are
  just "re-derive" (`src/domain/derive.ts`).

## Screens

| Route | Screen |
|---|---|
| `#/` | Home — history grouped by humanized date, new game |
| `#/setup/:id` | Tap-only setup: players, seating, suspects, deal, pot, your hand |
| `#/game/:id` | Live game: turn stepper, envelope odds, next move, position, deduction grid, case log |
| `#/review/:id` | Read-only review of a finished game |
| `#/leaderboard` | All-time records across closed cases |
| `#/settings` | Editable movement model (tier steps + room-distance matrix) |

## Tests

`tests/` covers the 13 acceptance criteria from the build spec (§15): solver rules 1–9,
reachability math, card-math validation, history buckets, and win recording, plus UI
smoke tests via jsdom.
