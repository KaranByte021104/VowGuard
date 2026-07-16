import { useState, useEffect } from 'react';
import { Shield, ToggleLeft, ToggleRight, X, UserPlus, Trash2 } from 'lucide-react';
import { useSessionStore } from '../store/session';
import { apiFetch } from '../lib/apiFetch';

interface Exemption {
  id: string;
  userId: string;
  user?: { email: string };
}

interface Control {
  id: string;
  action: string;
  isEnabled: boolean;
  description: string;
  exemptions: Exemption[];
}

export function AdminControls() {
  const { user } = useSessionStore();
  const [controls, setControls] = useState<Control[]>([]);
  const [orgUsers, setOrgUsers] = useState<any[]>([]);
  const [exemptionModal, setExemptionModal] = useState<{ open: boolean; action: string; actionLabel: string } | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [savingExemption, setSavingExemption] = useState(false);

  const descs: Record<string, string> = {
    'EXPORT_SECRETS': 'Block exporting secrets to CSV/JSON',
    'THIRD_PARTY_SHARING': 'Block sharing passwords with external email addresses',
    'OFFLINE_ACCESS': 'Block offline caching of vault'
  };

  const fetchControls = () => {
    apiFetch('http://localhost:3000/controls', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        const updatedControls: Control[] = data.map((c: any) => ({
          id: c.action,
          action: c.action,
          isEnabled: c.isEnabled,
          description: descs[c.action] || `Block ${c.action}`,
          exemptions: c.exemptions || []
        }));
        setControls(updatedControls);
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchControls();
    apiFetch('http://localhost:3000/users', { credentials: 'include' })
      .then(r => r.json()).then(setOrgUsers).catch(console.error);
  }, []);

  const handleToggle = async (id: string, currentEnabled: boolean) => {
    const newEnabled = !currentEnabled;
    setControls(prev => prev.map(c => c.id === id ? { ...c, isEnabled: newEnabled } : c));
    try {
      await apiFetch(`http://localhost:3000/controls/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isEnabled: newEnabled })
      });
    } catch (e) {
      console.error('Failed to toggle control', e);
      setControls(prev => prev.map(c => c.id === id ? { ...c, isEnabled: currentEnabled } : c));
    }
  };

  const handleAddExemption = async () => {
    if (!selectedUserId || !exemptionModal) return;
    setSavingExemption(true);
    try {
      await apiFetch(`http://localhost:3000/controls/${exemptionModal.action}/exemptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: selectedUserId })
      });
      setSelectedUserId('');
      fetchControls();
    } catch (e) {
      console.error(e);
    } finally {
      setSavingExemption(false);
    }
  };

  const handleRemoveExemption = async (action: string, userId: string) => {
    try {
      await apiFetch(`http://localhost:3000/controls/${action}/exemptions/${userId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      fetchControls();
    } catch (e) {
      console.error(e);
    }
  };

  if (user?.role !== 'SUPER_ADMIN' && user?.role !== 'ADMIN') {
    return <div className="p-8 text-center text-red-500">Access Denied. Administrators only.</div>;
  }

  const activeControl = controls.find(c => c.action === exemptionModal?.action);
  const exemptedUserIds = new Set(activeControl?.exemptions.map(e => e.userId) || []);
  const availableForExemption = orgUsers.filter(u => !exemptedUserIds.has(u.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <Shield className="w-8 h-8 text-primary" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Fine-Grained Controls</h2>
          <p className="text-gray-500 dark:text-gray-400">Manage organization-wide security restrictions and per-user exemptions.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {controls.map(control => (
            <div key={control.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    {control.action}
                    {control.isEnabled && (
                      <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full">Blocked</span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{control.description}</p>

                  {control.isEnabled && (
                    <div className="mt-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Exemptions ({control.exemptions.length})
                        </span>
                        <button
                          onClick={() => { setSelectedUserId(''); setExemptionModal({ open: true, action: control.action, actionLabel: control.description }); }}
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <UserPlus className="w-3 h-3" /> Add
                        </button>
                      </div>
                      {control.exemptions.length > 0 ? (
                        <ul className="space-y-1">
                          {control.exemptions.map(ex => (
                            <li key={ex.userId} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 px-3 py-1.5 rounded-md text-sm">
                              <span className="text-gray-700 dark:text-gray-300">{ex.user?.email || ex.userId}</span>
                              <button onClick={() => handleRemoveExemption(control.action, ex.userId)} className="text-red-500 hover:text-red-700">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-gray-400 italic">No exemptions — everyone is blocked.</p>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleToggle(control.id, control.isEnabled)}
                  className={`ml-4 flex items-center justify-center p-2 rounded-full transition-colors ${control.isEnabled ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20'}`}
                >
                  {control.isEnabled ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Exemption Modal */}
      {exemptionModal?.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add Exemption</h2>
              <button onClick={() => setExemptionModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Grant a specific user permission to bypass: <strong>{exemptionModal.actionLabel}</strong>
            </p>
            {availableForExemption.length === 0 ? (
              <p className="text-sm text-center text-gray-400 py-4 bg-gray-50 dark:bg-gray-700 rounded-lg">All org members already have exemptions.</p>
            ) : (
              <select
                value={selectedUserId}
                onChange={e => setSelectedUserId(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary outline-none"
              >
                <option value="">— Select a member —</option>
                {availableForExemption.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.email} ({u.role})</option>
                ))}
              </select>
            )}
            <div className="flex gap-3 mt-5 justify-end">
              <button onClick={() => setExemptionModal(null)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleAddExemption}
                disabled={!selectedUserId || savingExemption}
                className="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {savingExemption ? 'Adding...' : 'Grant Exemption'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
