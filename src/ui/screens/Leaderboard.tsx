import { useStore } from '../../store/store';
import { leaderboardRows } from '../../domain/leaderboard';
import { SectionPanel } from '../components';

export default function Leaderboard() {
  const games = useStore((s) => s.games);
  const roster = useStore((s) => s.roster);
  const rows = leaderboardRows(games, roster);

  return (
    <SectionPanel label="Records" extra="all-time, closed cases">
      {rows.length === 0 ? (
        <div className="empty-state">
          <p>No closed cases yet — finish a game and the records start here.</p>
        </div>
      ) : (
        <table className="ltable">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Detective</th>
              <th scope="col" className="num">
                Played
              </th>
              <th scope="col" className="num">
                Wins
              </th>
              <th scope="col" className="num">
                Rate
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.player.id}>
                <td className="rank">{i + 1}</td>
                <td>
                  <span
                    className="mini-dot"
                    style={{ background: row.player.color, marginRight: 8 }}
                  />
                  {row.player.name}
                </td>
                <td className="num">{row.played}</td>
                <td className="num">
                  <strong>{row.wins}</strong>
                </td>
                <td className="num">{Math.round(row.winRate * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </SectionPanel>
  );
}
