import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import ProfileWizard from './pages/ProfileWizard';
import ProfileStart from './pages/ProfileStart';
import SubscribersPage from './pages/SubscribersPage';
import EditionWorkflow from './pages/EditionWorkflow';

export default function App() {
  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f7', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <Routes>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/profiles/new" element={<ProfileWizard />} />
        <Route path="/profiles/:profileId/start" element={<ProfileStart />} />
        <Route path="/profiles/:profileId/subscribers" element={<SubscribersPage />} />
        <Route path="/editions/:correlationId/*" element={<EditionWorkflow />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </div>
  );
}
