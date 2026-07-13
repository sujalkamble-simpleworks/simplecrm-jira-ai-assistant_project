import { Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import LogTaskPage from './pages/LogTaskPage';
import BugReporterPage from './pages/BugReporterPage';
import AdminPage from './pages/AdminPage';
import './App.css';

function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/log-task" element={<LogTaskPage />} />
      <Route path="/bug-reporter" element={<BugReporterPage />} />
      <Route path="/admin" element={<AdminPage />} />
    </Routes>
  );
}

export default App;