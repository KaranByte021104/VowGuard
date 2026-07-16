import toast from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { useSessionStore } from '../store/session';
import { Plus, Server, Download } from 'lucide-react';
import { Modal } from '../components/Modal';
import { apiFetch } from '../lib/apiFetch';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';

export function SsoDashboard() {
  const { user } = useSessionStore();
  const [apps, setApps] = useState<any[]>([]);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [newApp, setNewApp] = useState({ name: '', description: '', acsUrl: '', audienceUri: '' });
  const [createdAppId, setCreatedAppId] = useState<string | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [grantedUsers, setGrantedUsers] = useState<string[]>([]);
  
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, appId: string}>({ isOpen: false, appId: '' });

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
        toast.error('Failed to create app');
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
    a.download = `VowGuard-IdP-Metadata.xml`;
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

  const handleDisableApp = (appId: string) => {
    setConfirmModal({ isOpen: true, appId });
  };

  const confirmDisableApp = async () => {
    if (!confirmModal.appId) return;
    try {
      await apiFetch(`http://localhost:3000/sso/apps/${confirmModal.appId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: false }),
        credentials: 'include'
      });
      fetchApps();
    } catch (e) {
      console.error(e);
      toast.error("Failed to disable app");
    } finally {
      setConfirmModal({ isOpen: false, appId: '' });
    }
  };

  const renderWizardStep1 = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">App Name</label>
        <Input type="text" value={newApp.name} onChange={e => setNewApp({ ...newApp, name: e.target.value })} />
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Description</label>
        <Input type="text" value={newApp.description} onChange={e => setNewApp({ ...newApp, description: e.target.value })} />
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Assertion Consumer Service (ACS) URL</label>
        <Input type="url" value={newApp.acsUrl} onChange={e => setNewApp({ ...newApp, acsUrl: e.target.value })} placeholder="https://app.example.com/saml/acs" />
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Audience URI (Entity ID)</label>
        <Input type="text" value={newApp.audienceUri} onChange={e => setNewApp({ ...newApp, audienceUri: e.target.value })} placeholder="https://app.example.com/saml/metadata" />
      </div>
      <div className="flex justify-end pt-4">
        <Button onClick={handleCreateApp} disabled={!newApp.name || !newApp.acsUrl || !newApp.audienceUri}>Next: IdP Configuration</Button>
      </div>
    </div>
  );

  const renderWizardStep2 = () => (
    <div className="space-y-6">
      <div className="bg-blue-50/50 border border-blue-200/50 text-blue-800 dark:text-blue-300 dark:bg-blue-900/20 dark:border-blue-800/50 rounded-lg p-4">
        <h4 className="font-semibold mb-1">Identity Provider Setup</h4>
        <p className="text-sm">Download the metadata XML file below and upload it to the target application's SSO settings. This contains the VowGuard signing certificates and Login URLs.</p>
      </div>
      <div className="flex justify-center">
        <Button variant="outline" size="lg" onClick={handleDownloadMetadata}>
          <Download className="w-5 h-5 text-primary mr-2" />
          Download IdP Metadata XML
        </Button>
      </div>
      <div className="flex justify-end pt-4">
        <Button onClick={() => setStep(3)}>Next: Manage Access</Button>
      </div>
    </div>
  );

  const renderWizardStep3 = () => (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Select which users are allowed to use this application via SSO.</p>
      <div className="border border-border rounded-lg max-h-64 overflow-y-auto bg-card">
        {users.map(u => (
          <div key={u.id} className="flex items-center justify-between p-3 border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
            <div>
              <p className="text-sm font-medium text-foreground">{u.email}</p>
              <p className="text-xs text-muted-foreground">{u.role}</p>
            </div>
            <Button size="sm" variant={grantedUsers.includes(u.id) ? 'default' : 'secondary'} className={grantedUsers.includes(u.id) ? 'bg-status-success hover:bg-status-success/90 text-white' : ''} onClick={() => toggleGrant(u.id)}>
              {grantedUsers.includes(u.id) ? 'Granted' : 'Grant Access'}
            </Button>
          </div>
        ))}
      </div>
      <div className="flex justify-end pt-4">
        <Button onClick={() => { setIsWizardOpen(false); setStep(1); fetchApps(); }}>Complete Registration</Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">SSO Applications</h1>
          <p className="text-muted-foreground">Manage SAML applications available to your organization.</p>
        </div>
        <Button onClick={() => { setStep(1); setNewApp({ name: '', description: '', acsUrl: '', audienceUri: '' }); setGrantedUsers([]); setCreatedAppId(null); setIsWizardOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Register New App
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {apps.map(app => (
          <div key={app.id} className={`bg-card rounded-xl shadow-sm border ${app.isEnabled ? 'border-border' : 'border-destructive bg-destructive/10'} p-6`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground flex items-center gap-2">
                    {app.name}
                    {!app.isEnabled && <Badge variant="destructive">Disabled</Badge>}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-1">{app.description}</p>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border flex justify-between items-center text-sm">
              <span className="text-muted-foreground">{app._count?.accesses || 0} users granted</span>
              {app.isEnabled && (
                <Button variant="ghost" size="sm" onClick={() => handleDisableApp(app.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10">Disable</Button>
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

      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, appId: '' })}
        title="Disable SSO Application"
        message="Are you sure you want to disable this SSO application? Users will no longer be able to log in through it."
        confirmText="Disable App"
        confirmColor="red"
        onConfirm={confirmDisableApp}
      />
    </div>
  );
}
