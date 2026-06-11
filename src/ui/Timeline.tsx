import type { Game } from '../domain/types';
import { describeEvent } from '../domain/derive';

export function Timeline(props: {
  game: Game;
  onUndo?: () => void;
  /** newest first when true (live screen); chronological for review. */
  reverse?: boolean;
  limit?: number;
}) {
  const { game } = props;
  if (game.events.length === 0) {
    return (
      <p className="hint">
        Nothing on file yet. Log the first suggestion when someone makes one.
      </p>
    );
  }
  let events = props.reverse ? [...game.events].reverse() : game.events;
  if (props.limit && events.length > props.limit) events = events.slice(0, props.limit);
  const lastId = game.events[game.events.length - 1]?.id;

  return (
    <div>
      {events.map((ev) => (
        <div key={ev.id} className="timeline-item">
          <span className="timeline-turn">T{ev.turn}</span>
          <span className="timeline-text">{describeEvent(ev, game)}</span>
          {props.onUndo && ev.id === lastId && (
            <button type="button" className="btn btn-small btn-danger" onClick={props.onUndo}>
              Undo
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
