import { HashRouter, Link, Route, Routes, useLocation } from 'react-router-dom';
import Home from './ui/screens/Home';
import Setup from './ui/screens/Setup';
import Live from './ui/screens/Live';
import Review from './ui/screens/Review';
import Leaderboard from './ui/screens/Leaderboard';
import SettingsScreen from './ui/screens/Settings';

function Masthead() {
  const location = useLocation();
  const atHome = location.pathname === '/';
  return (
    <header className="masthead">
      <div className="masthead-row">
        {atHome ? (
          <div className="masthead-title">
            <span className="masthead-clue">CLUE</span>
            <span className="masthead-sub">CASE FILES</span>
          </div>
        ) : (
          <Link to="/" className="masthead-title masthead-link" aria-label="Back to case files">
            <span className="masthead-clue">CLUE</span>
            <span className="masthead-sub">CASE FILES</span>
          </Link>
        )}
        <nav className="masthead-nav" aria-label="Main">
          <Link to="/leaderboard" className="nav-link" aria-label="Leaderboard">
            Records
          </Link>
          <Link to="/settings" className="nav-link" aria-label="Settings">
            Board
          </Link>
        </nav>
      </div>
      <div className="masthead-rule" aria-hidden="true" />
    </header>
  );
}

export default function App() {
  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="app">
        <Masthead />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/setup/:id" element={<Setup />} />
            <Route path="/game/:id" element={<Live />} />
            <Route path="/review/:id" element={<Review />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/settings" element={<SettingsScreen />} />
            <Route
              path="*"
              element={
                <div className="panel empty-state">
                  <p>That page isn’t in this case file.</p>
                  <Link className="btn" to="/">
                    Back to case files
                  </Link>
                </div>
              }
            />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}
