import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import SmeSearchPage from './pages/SmeSearchPage';
import RequestsPage from './pages/RequestsPage';
import ImportPage from './pages/ImportPage';
import RespondPage from './pages/RespondPage';
import VisitorSigninPage from './pages/VisitorSigninPage';
import VisitorKioskPage from './pages/VisitorKioskPage';

function Protected({ children }) {
  return localStorage.getItem('token') ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/respond" element={<RespondPage />} />
      <Route path="/visitor-signin" element={<VisitorSigninPage />} />
      <Route path="/" element={<Protected><AppShell /></Protected>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/smes" element={<SmeSearchPage />} />
        <Route path="/smes/import" element={<ImportPage />} />
        <Route path="/requests" element={<RequestsPage />} />
        <Route path="/visitor-kiosk" element={<VisitorKioskPage />} />
        <Route path="/import" element={<Navigate to="/smes/import" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
