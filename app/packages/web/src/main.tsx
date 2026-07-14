import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Signup } from './pages/Signup';
import { Login } from './pages/Login';
import { SecretsList } from './pages/SecretsList';
import { SecretDetail } from './pages/SecretDetail';
import { AddSecret } from './pages/AddSecret';
import { ImportSecrets } from './pages/ImportSecrets';
import { Sharing } from './pages/Sharing';
import { AuthGuard } from './components/AuthGuard';
import { Approvals } from './pages/Approvals';
import { EmergencyAccess } from './pages/EmergencyAccess';
import { EmergencyVault } from './pages/EmergencyVault';
import { SsoDashboard } from './pages/SsoDashboard';
import { SsoDispatch } from './pages/SsoDispatch';
import { ConnectedApps } from './pages/ConnectedApps';
import { CloudBackup } from './pages/CloudBackup';
import { Dashboard } from './pages/Dashboard';
import { AdminControls } from './pages/AdminControls';
import { AlertRules } from './pages/AlertRules';
import { UserManagement } from './pages/UserManagement';
import { SecuritySettings } from './pages/SecuritySettings';
import './index.css';
import App from './App.tsx';

const queryClient = new QueryClient();

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{title}</h2>
      <p className="text-gray-500 dark:text-gray-400">
        This screen is a placeholder. Functionality will be added in upcoming sprints.
      </p>
    </div>
  );
}

import { Toaster } from 'react-hot-toast';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-right" />
      <BrowserRouter>
        <Routes>
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/sso-dispatch" element={<SsoDispatch />} />
          <Route path="/" element={<AuthGuard><App /></AuthGuard>}>
            <Route index element={<Dashboard />} />
            <Route path="secrets" element={<SecretsList />} />
            <Route path="secrets/new" element={<AddSecret />} />
            <Route path="secrets/:id" element={<SecretDetail />} />
            <Route path="import" element={<ImportSecrets />} />
            <Route path="sharing" element={<Sharing />} />
            <Route path="approvals" element={<Approvals />} />
            <Route path="emergency" element={<EmergencyAccess />} />
            <Route path="emergency/:ownerId" element={<EmergencyVault />} />
            <Route path="connected-apps" element={<ConnectedApps />} />
            <Route path="backup" element={<CloudBackup />} />
            <Route path="backup/callback/google" element={<CloudBackup />} />
            <Route path="reporting" element={<PlaceholderPage title="Audit & Reporting" />} />
            <Route path="admin" element={<PlaceholderPage title="Administration" />} />
            <Route path="admin/controls" element={<AdminControls />} />
            <Route path="admin/sso" element={<SsoDashboard />} />
            <Route path="admin/users" element={<UserManagement />} />
            <Route path="alerts" element={<AlertRules />} />
            <Route path="security" element={<SecuritySettings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
