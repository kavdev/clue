import { useStore } from '../../store/store';
import { ROOM_CARDS, cardName, type RoomId } from '../../domain/cards';
import {
  DOORS,
  defaultBoardSettings,
  secretPassageFrom,
  tierBetween,
  type Tier,
} from '../../domain/board';
import { SectionPanel, Stepper } from '../components';

const NEXT_TIER: Record<Tier, Tier> = { near: 'mid', mid: 'far', far: 'near' };

export default function SettingsScreen() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const setMatrixTier = useStore((s) => s.setMatrixTier);

  return (
    <div>
      <SectionPanel label="Movement model" extra="steps per tier">
        <p className="hint">
          Reach odds use P(2d6 ≥ steps). Tune the step counts if the defaults feel off for
          your table.
        </p>
        {(['near', 'mid', 'far'] as const).map((tier) => (
          <div key={tier} className="seat-row">
            <span className="seat-name">
              <span className="nm" style={{ textTransform: 'capitalize' }}>
                {tier} rooms
              </span>
            </span>
            <Stepper
              value={settings.tierSteps[tier]}
              min={2}
              max={14}
              label={`${tier} steps`}
              onChange={(v) =>
                updateSettings({ tierSteps: { ...settings.tierSteps, [tier]: v } })
              }
            />
          </div>
        ))}
        <div className="seat-row">
          <span className="seat-name">
            <span className="nm">From the hallway</span>
          </span>
          <Stepper
            value={settings.hallwaySteps}
            min={2}
            max={14}
            label="hallway steps"
            onChange={(v) => updateSettings({ hallwaySteps: v })}
          />
        </div>
      </SectionPanel>

      <SectionPanel label="Room distances" extra="tap to cycle near / mid / far">
        <p className="hint">
          Grounded in the 1998 board. Secret passages (Study ↔ Kitchen, Lounge ↔
          Conservatory) are always one guaranteed move and ignore these tiers. Rooms with
          more doors resolve to their nearest door automatically.
        </p>
        {ROOM_CARDS.map((roomCard) => {
          const room = roomCard.id as RoomId;
          return (
            <div key={room} className="matrix-room">
              <div className="matrix-room-name">
                {roomCard.name}{' '}
                <span className="fine">
                  ({DOORS[room]} door{DOORS[room] > 1 ? 's' : ''}
                  {secretPassageFrom(room) ? `, passage to ${cardName(secretPassageFrom(room)!)}` : ''})
                </span>
              </div>
              <div>
                {ROOM_CARDS.filter((other) => other.id !== room).map((other) => {
                  const b = other.id as RoomId;
                  const tier = tierBetween(room, b, settings.matrix);
                  return (
                    <button
                      key={b}
                      type="button"
                      className={`tier-chip tier-${tier}`}
                      onClick={() => setMatrixTier(room, b, NEXT_TIER[tier])}
                    >
                      {other.short}
                      <span className="tier-tag">{tier}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        <button
          type="button"
          className="btn btn-danger btn-small"
          onClick={() => {
            const d = defaultBoardSettings();
            updateSettings({ matrix: d.matrix, tierSteps: d.tierSteps, hallwaySteps: d.hallwaySteps });
          }}
        >
          Reset board model to defaults
        </button>
      </SectionPanel>
    </div>
  );
}
