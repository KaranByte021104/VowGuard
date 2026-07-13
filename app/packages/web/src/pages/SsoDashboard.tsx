import { useState, useEffect } from 'react';
import { useSessionStore } from '../store/session';
import { Plus, Server, Download } from 'lucide-react';
import { Modal } from '../components/Modal';
import { apiFetch } from '../lib/apiFetch';

export function SsoDashboard() {
  const { user } = useSessionStore();
  const [apps, setApps] = useState<any[]>([]);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [newApp, setNewApp] = useState({ name: '', description: '', acsUrl: '', audienceUri: '' });
  const [createdAppId, setCreatedAppId] = useState<string | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [grantedUsers, setGrantedUsers] = useState<string[]>([]);
  
  useEffect(() => {
    fetchApps();
    fetchUsers();
  }, []);

  const fetchApps = async () => {
    try {
      const res = await apiFetch('http://localhost:3000/sso/apps', { credentials: 'include' });
      const data = await res.json();
      setApps(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await apiFetch('http://localhost:3000/users', { credentials: 'include' });
      const data = await res.json();
      setUsers(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateApp = async () => {
    try {
      const res = await apiFetch('http://localhost:3000/sso/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newApp),
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setCreatedAppId(data.id);
        setStep(2);
        fetchApps();
      } else {
        alert('Failed to create app');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownloadMetadata = async () => {
    if (!user) return;
    const res = await apiFetch(`http://localhost:3000/sso/metadata/${user.organizationId}`);
    const xml = await res.text();
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SecureVault-IdP-Metadata.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const toggleGrant = async (userId: string) => {
    if (!createdAppId) return;
    const isGranted = grantedUsers.includes(userId);
    try {
      const method = isGranted ? 'DELETE' : 'POST';
      await apiFetch(`http://localhost:3000/sso/apps/${createdAppId}/access/${userId}`, {
        method,
        credentials: 'include'
      });
      if (isGranted) {
        setGrantedUsers(prev => prev.filter(id => id !== userId));
      } else {
        setGrantedUsers(prev => [...prev, userId]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDisableApp = async (appId: string) => {
    if (confirm('Are you sure you want to disable this SSO application? Users will no longer be able to log in through it.')) {
      await apiFetch(`http://localhost:3000/sso/apps/${appId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: false }),
        credentials: 'include'
      });
      fetchApps();
    }
  };

  const renderWizardStep1 = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">App Name</label>
        <input type="text" value={newApp.name} onChange={e => setNewApp({ ...newApp, name: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
        <input type="text" value={newApp.description} onChange={e => setNewApp({ ...newApp, description: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Assertion Consumer Service (ACS) URL</label>
        <input type="url" value={newApp.acsUrl} onChange={e => setNewApp({ ...newApp, acsUrl: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="https://app.example.com/saml/acs" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Audience URI (Entity ID)</label>
        <input type="text" value={newApp.audienceUri} onChange={e => setNewApp({ ...newApp, audienceUri: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="https://app.example.com/saml/metadata" />
      </div>
      <div className="flex justify-end pt-4">
        <button onClick={handleCreateApp} disabled={!newApp.name || !newApp.acsUrl || !newApp.audienceUri} className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50">Next: IdP Configuration</button>
      </div>
    </div>
  );

  const renderWizardStep2 = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-4">
        <h4 className="font-semibold mb-1">Identity Provider Setup</h4>
        <p className="text-sm">Download the metadata XML file below and upload it to the target application's SSO settings. This contains the SecureVault signing certificates and Login URLs.</p>
      </div>
      <div className="flex justify-center">
        <button onClick={handleDownloadMetadata} className="flex items-center gap-2 bg-white border border-gray-300 px-6 py-3 rounded-lg shadow-sm hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-white dark:hover:bg-gray-700">
          <Download className="w-5 h-5 text-indigo-600" />
          Download IdP Metadata XML
        </button>
      </div>
      <div className="flex justify-end pt-4">
        <button onClick={() => setStep(3)} className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">Next: Manage Access</button>
      </div>
    </div>
  );

  const renderWizardStep3 = () => (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">Select which users are allowed to use this application via SSO.</p>
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-64 overflow-y-auto">
        {users.map(u => (
          <div key={u.id} className="flex items-center justify-between p-3 border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{u.email}</p>
              <p className="text-xs text-gray-500">{u.role}</p>
            </div>
            <button onClick={() => toggleGrant(u.id)} className={`px-3 py-1 rounded-full text-xs font-medium ${grantedUsers.includes(u.id) ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {grantedUsers.includes(u.id) ? 'Granted' : 'Grant Access'}
            </button>
          </div>
        ))}
      </div>
      <div className="flex justify-end pt-4">
        <button onClick={() => { setIsWizardOpen(false); setStep(1); fetchApps(); }} className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">Complete Registration</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">SSO Applications</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage SAML applications available to your organization.</p>
        </div>
        <button onClick={() => { setStep(1); setNewApp({ name: '', description: '', acsUrl: '', audienceUri: '' }); setGrantedUsers([]); setCreatedAppId(null); setIsWizardOpen(true); }} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
          <Plus className="w-4 h-4" /> Register New App
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {apps.map(app => (
          <div key={app.id} className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border ${app.isEnabled ? 'border-gray-200 dark:border-gray-700' : 'border-red-200 bg-red-50 dark:bg-red-900/10'} p-6`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    {app.name}
                    {!app.isEnabled && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">Disabled</span>}
                  </h3>
                  <p className="text-sm text-gray-500 line-clamp-1">{app.description}</p>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center text-sm">
              <span className="text-gray-500">{app._count?.accesses || 0} users granted</span>
              {app.isEnabled && (
                <button onClick={() => handleDisableApp(app.id)} className="text-red-600 hover:text-red-800 font-medium">Disable</button>
              )}
            </div>
          </div>
        ))}
        {apps.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-500 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
            <Server className="w-8 h-8 mx-auto mb-3 text-gray-400" />
            <p>No SSO applications registered yet.</p>
          </div>
        )}
      </div>

      <Modal isOpen={isWizardOpen} onClose={() => { setIsWizardOpen(false); setStep(1); }} title="Register SAML Application">
        <div className="mb-6">
          <div className="flex items-center">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${step >= 1 ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'}`}>1</div>
            <div className={`flex-1 h-1 mx-2 ${step >= 2 ? 'bg-indigo-600' : 'bg-gray-200'}`}></div>
            <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${step >= 2 ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'}`}>2</div>
            <div className={`flex-1 h-1 mx-2 ${step >= 3 ? 'bg-indigo-600' : 'bg-gray-200'}`}></div>
            <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${step >= 3 ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'}`}>3</div>
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500 font-medium px-1">
            <span>App Details</span>
            <span>IdP Setup</span>
            <span>Access</span>
          </div>
        </div>

        {step === 1 && renderWizardStep1()}
        {step === 2 && renderWizardStep2()}
        {step === 3 && renderWizardStep3()}
      </Modal>
    </div>
  );
}
