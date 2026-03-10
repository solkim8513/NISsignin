import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell';
import LoginPage from './pages/LoginPage';
import VisitorSigninPage from './pages/VisitorSigninPage';
import VisitorKioskPage from './pages/VisitorKioskPage';

function Protected({ children }) {
  return localStorage.getItem('token') ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<VisitorSigninPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/visitor-signin" element={<VisitorSigninPage />} />
      <Route path="/visitor-kiosk" element={<Protected><AppShell /></Protected>}>
        <Route index element={<VisitorKioskPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
