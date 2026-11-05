import { createContext, useContext, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { AppInfo } from '@shared/types.ts';
import { api, flushQueue } from './api.ts';
import { BottomNav, ErrorState, Loading, ToastHost } from './components/ui.tsx';
import CoachPage from './pages/CoachPage.tsx';
import ExerciseDetail from './pages/ExerciseDetail.tsx';
import LoginPage from './pages/LoginPage.tsx';
import ProfilePage from './pages/ProfilePage.tsx';
import ProgramPage from './pages/ProgramPage.tsx';
import ProgressPage from './pages/ProgressPage.tsx';
import SummaryPage from './pages/SummaryPage.tsx';
import TodayPage from './pages/TodayPage.tsx';
import WorkoutPage from './pages/WorkoutPage.tsx';

const InfoContext = createContext<AppInfo | null>(null);
export const useInfo = () => useContext(InfoContext)!;

export default function App() {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();

  const load = () => {
    setError(null);
    api
      .info()
      .then(setInfo)
      .catch((e: Error) => setError(e.message));
  };

  useEffect(() => {
    load();
    const onUnauthorized = () => setInfo((i) => (i ? { ...i, authenticated: false } : i));
    window.addEventListener('overload:unauthorized', onUnauthorized);
    return () => window.removeEventListener('overload:unauthorized', onUnauthorized);
  }, []);

  useEffect(() => {
    if (info?.authenticated) void flushQueue();
  }, [info?.authenticated]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!info) return <Loading />;
  if (info.authRequired && !info.authenticated) return <LoginPage info={info} onSuccess={load} />;

  const fullScreen = location.pathname.startsWith('/workout/');

  return (
    <InfoContext.Provider value={info}>
      <Routes>
        <Route path="/" element={<TodayPage />} />
        <Route path="/program" element={<ProgramPage />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="/progress/:exerciseId" element={<ExerciseDetail />} />
        <Route path="/coach" element={<CoachPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/workout/:id" element={<WorkoutPage />} />
        <Route path="/workout/:id/summary" element={<SummaryPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!fullScreen && <BottomNav />}
      <ToastHost />
    </InfoContext.Provider>
  );
}
