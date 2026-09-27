import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import LiveTelemetryBackground from './components/LiveTelemetryBackground';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Alerts from './pages/Alerts';
import History from './pages/History';
import Settings from './pages/Settings';
import Team from './pages/Team';
import Servers from './pages/Servers';

const ProtectedLayout = () => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  const isAdmin = localStorage.getItem('role') === 'admin';

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="relative flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-100/60 dark:bg-slate-950/90">
          <LiveTelemetryBackground />
          <div className="relative z-10">
            <Routes>
              <Route path="/servers" element={<Servers />} />
              <Route path="/servers/:id/dashboard" element={<Dashboard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/history" element={<History />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/team" element={isAdmin ? <Team /> : <Navigate to="/servers" replace />} />
              <Route path="*" element={<Navigate to="/servers" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={<ProtectedLayout />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
