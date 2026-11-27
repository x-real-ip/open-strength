import { createContext, useContext, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { AppInfo, Language } from '@shared/types.ts';
import { api, flushQueue } from './api.ts';
import { getLang, setLang } from './i18n.ts';
import { BottomNav, ErrorState, Loading, ToastHost } from './components/ui.tsx';
import AiPage from './pages/AiPage.tsx';
import CoachPage from './pages/CoachPage.tsx';
import ExerciseDetail from './pages/ExerciseDetail.tsx';
import ExerciseGuidePage from './pages/ExerciseGuidePage.tsx';
import ExercisesPage from './pages/ExercisesPage.tsx';
import LoginPage from './pages/LoginPage.tsx';
import ProfilePage from './pages/ProfilePage.tsx';
import ProgramPage from './pages/ProgramPage.tsx';
import ProgressPage from './pages/ProgressPage.tsx';
import SummaryPage from './pages/SummaryPage.tsx';
import TodayPage from './pages/TodayPage.tsx';
import WorkoutPage from './pages/WorkoutPage.tsx';

const InfoContext = createContext<AppInfo | null>(null);
export const useInfo = () => useContext(InfoContext)!;
const RefreshInfoContext = createContext<() => void>(() => {});
/** Reload /api/info, e.g. after the AI settings changed. */
export const useRefreshInfo = () => useContext(RefreshInfoContext);
const SetLanguageContext = createContext<(lang: Language) => void>(() => {});
/** Switch the UI language right away; every screen remounts in the new language. */
export const useSetLanguage = () => useContext(SetLanguageContext);

export default function App() {
  const [info, setInfo] = useState<AppInfo | null>(null);
  // Bumped when the language changes, so every screen remounts and reloads its text.
  const [lang, setLangState] = useState(getLang());
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();

  const load = () => {
    setError(null);
    api
      .info()
      .then((i) => {
        if (i.language !== getLang()) {
          setLang(i.language);
          setLangState(i.language);
        }
        setInfo(i);
      })
      .catch((e: Error) => setError(e.message));
  };

  useEffect(() => {
    load();
    const onUnauthorized = () => setInfo((i) => (i ? { ...i, authenticated: false } : i));
    window.addEventListener('open-strength:unauthorized', onUnauthorized);
    return () => window.removeEventListener('open-strength:unauthorized', onUnauthorized);
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
      <RefreshInfoContext.Provider value={load}>
      <SetLanguageContext.Provider
        value={(l) => {
          setLang(l);
          setLangState(l);
        }}
      >
      <div className={fullScreen ? 'shell' : 'shell with-nav'}>
      <Routes key={lang}>
        <Route path="/" element={<TodayPage />} />
        <Route path="/program" element={<ProgramPage />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="/progress/:exerciseId" element={<ExerciseDetail />} />
        <Route path="/exercises" element={<ExercisesPage />} />
        <Route path="/exercises/:exerciseId" element={<ExerciseGuidePage />} />
        <Route path="/coach" element={<CoachPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/ai" element={<AiPage />} />
        <Route path="/workout/:id" element={<WorkoutPage />} />
        <Route path="/workout/:id/summary" element={<SummaryPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </div>
      {!fullScreen && <BottomNav version={info.version} />}
      <ToastHost />
      </SetLanguageContext.Provider>
      </RefreshInfoContext.Provider>
    </InfoContext.Provider>
  );
}
