import { useState, useEffect } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import { BookOpen, FileText, Bookmark, Share2, Wifi, WifiOff } from 'lucide-react';
import Books from './pages/Books';
import Notes from './pages/Notes';
import Citations from './pages/Citations';
import MindMaps from './pages/MindMaps';
import { getSyncState, subscribeToSyncState } from './lib/sync';

export default function App() {
  const [syncState, setSyncState] = useState(getSyncState());

  useEffect(() => {
    return subscribeToSyncState(setSyncState);
  }, []);

  const syncPresentation = (() => {
    if (!syncState.networkOnline) {
      return {
        className: 'is-offline',
        icon: <WifiOff size={16} />,
        label: 'Offline - Local only',
      };
    }

    if (syncState.isSyncing) {
      return {
        className: 'is-syncing',
        icon: <Wifi size={16} />,
        label: 'Online - Syncing',
      };
    }

    if (syncState.serverReachable === false) {
      return {
        className: 'is-warning',
        icon: <WifiOff size={16} />,
        label: 'Online - Server unavailable',
      };
    }

    if (syncState.serverReachable === true) {
      return {
        className: 'is-online',
        icon: <Wifi size={16} />,
        label: 'Online - Synced',
      };
    }

    return {
      className: 'is-syncing',
      icon: <Wifi size={16} />,
      label: 'Online - Checking server',
    };
  })();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-wrap">
          <div className="brand-badge">
            <BookOpen size={18} />
          </div>
          <div className="brand-copy">
            <p className="brand-kicker">Editorial Library</p>
            <p className="brand-title">Lumina Reading Manager</p>
            <p className="brand-subtitle">A calmer desk for books, notes, citations, and idea maps.</p>
          </div>
        </div>
        <div className="header-meta">
          <div className={`sync-status ${syncPresentation.className}`}>
            {syncPresentation.icon}
            {syncPresentation.label}
          </div>
          <p className="header-note">Organize thoughts like marginalia, not scattered tabs.</p>
        </div>
      </header>

      <nav className="nav-links">
        <span className="nav-label">Library Rooms</span>
        <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <BookOpen size={18} /> Reading List
        </NavLink>
        <NavLink to="/notes" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <FileText size={18} /> Notes
        </NavLink>
        <NavLink to="/citations" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Bookmark size={18} /> Citations
        </NavLink>
        <NavLink to="/mindmaps" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Share2 size={18} /> Mind Maps
        </NavLink>
      </nav>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<Books />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/citations" element={<Citations />} />
          <Route path="/mindmaps" element={<MindMaps />} />
        </Routes>
      </main>
    </div>
  );
}
