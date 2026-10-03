import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { withAuth } from './utils/withAuth';
import ErrorBoundary from './components/ErrorBoundary'; 
import LandingPage from './pages/landing';
import AuthenticationPage from './pages/authentication';
import HomePage from './pages/home';
import VideoMeet from './pages/VideoMeet';
import HistoryPage from './pages/history';
import AttendanceHistoryPage from './pages/AttendanceHistory';
import AttendanceAnalyticsPage from './pages/AttendanceAnalytics';
import JoinPage from './pages/join';        // 7B — deliberately NOT protected
import NotFound from './pages/notFound';    // 7D — the `*` target

const ProtectedHome = withAuth(HomePage);

const ProtectedHistory = withAuth(HistoryPage);
const ProtectedAttendance = withAuth(AttendanceHistoryPage);
const ProtectedAnalytics = withAuth(AttendanceAnalyticsPage);

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<AuthenticationPage />} />
            <Route path="/home" element={<ProtectedHome />} />
            <Route path="/meeting/:code" element={<VideoMeet />} />
            <Route path="/join/:code" element={<JoinPage />} />
            <Route path="/history" element={<ProtectedHistory />} />
            <Route path="/attendance" element={<ProtectedAttendance />} />
            <Route path="/analytics" element={<ProtectedAnalytics />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;



