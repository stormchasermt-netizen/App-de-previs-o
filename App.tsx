import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { MultiplayerProvider } from './contexts/MultiplayerContext';
import Layout from './components/Layout';

// Pages
import Home from './pages/Home';
import Game from './pages/Game';
import Admin from './pages/Admin';
import Ranking from './pages/Ranking';
import Login from './pages/Login';
import Rules from './pages/Rules';
import Lobby from './pages/Lobby';
import LobbyLeaderboard from './pages/LobbyLeaderboard';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
          <MultiplayerProvider>
            <Layout>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/jogar" element={<Game />} />
                <Route path="/ranking" element={<Ranking />} />
                <Route path="/regras" element={<Rules />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/login" element={<Login />} />
                
                {/* Multiplayer Routes */}
                <Route path="/lobby/:code" element={<Lobby />} />
                <Route path="/lobby-leaderboard" element={<LobbyLeaderboard />} />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </MultiplayerProvider>
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
}