import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { getSession, isDevMode } from './auth';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import ProfileWizard from './pages/ProfileWizard';
import ProfileStart from './pages/ProfileStart';
import ProfileEdit from './pages/ProfileEdit';
import SubscribersPage from './pages/SubscribersPage';
import SourcesPage from './pages/SourcesPage';
import LoginPage from './pages/LoginPage';
import BrowsePage from './pages/BrowsePage';
import SettingsPage from './pages/SettingsPage';
import EditionWorkflow from './pages/EditionWorkflow';

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    getSession().then(s => { setIsLoggedIn(s.isLoggedIn); setAuthChecked(true); });
  }, []);

  if (!authChecked) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: '#888' }}>Loading...</div>;

  return (
    <div style={{ minHeight: '100vh', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <Routes>
        <Route path="/login" element={isLoggedIn ? <Navigate to="/dashboard" replace /> : <LoginPage onLogin={() => setIsLoggedIn(true)} />} />
        <Route path="/browse" element={<BrowsePage />} />
        <Route path="/" element={<BrowsePage />} />
        <Route path="*" element={isLoggedIn ? (
          <Layout>
            <Routes>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/profiles/new" element={<ProfileWizard />} />
              <Route path="/profiles/:profileId/start" element={<ProfileStart />} />
              <Route path="/profiles/:profileId/edit" element={<ProfileEdit />} />
              <Route path="/profiles/:profileId/subscribers" element={<SubscribersPage />} />
              <Route path="/profiles/:profileId/sources" element={<SourcesPage />} />
              <Route path="/editions/:correlationId/*" element={<EditionWorkflow />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Layout>
        ) : <Navigate to="/browse" replace />} />
      </Routes>
    </div>
  );
}
