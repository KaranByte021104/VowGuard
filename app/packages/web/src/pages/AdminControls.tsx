import { useState, useEffect } from 'react';
import { Shield, ToggleLeft, ToggleRight, AlertTriangle } from 'lucide-react';
import { useSessionStore } from '../store/session';

export function AdminControls() {
  const { user } = useSessionStore();
  const [controls, setControls] = useState<any[]>([]);

  useEffect(() => {
    fetch('http://localhost:3000/controls', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        // Map database state with human readable descriptions
        const descs: Record<string, string> = {
          'EXPORT_SECRETS': 'Block exporting secrets to CSV/JSON',
          'THIRD_PARTY_SHARING': 'Block sharing passwords with external email addresses',
          'OFFLINE_ACCESS': 'Block offline caching of vault'
        };
        const updatedControls = data.map((c: any) => ({
          id: c.action, // using action as id
          action: c.action,
          isEnabled: c.isEnabled,
          description: descs[c.action] || `Block ${c.action}`
        }));
        setControls(updatedControls);
      })
      .catch(console.error);
  }, []);

  const handleToggle = async (id: string, currentEnabled: boolean) => {
    const newEnabled = !currentEnabled;
    // Optimistic UI update
    setControls(controls.map(c => c.id === id ? { ...c, isEnabled: newEnabled } : c));
    
    try {
      await fetch(`http://localhost:3000/controls/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isEnabled: newEnabled })
      });
    } catch (e) {
      console.error('Failed to toggle control', e);
      // Revert on failure
      setControls(controls.map(c => c.id === id ? { ...c, isEnabled: currentEnabled } : c));
    }
  };

  if (user?.role !== 'SUPER_ADMIN' && user?.role !== 'ADMIN') {
    return <div className="p-8 text-center text-red-500">Access Denied. Administrators only.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <Shield className="w-8 h-8 text-primary" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Fine-Grained Controls</h2>
          <p className="text-gray-500 dark:text-gray-400">Manage organization-wide security restrictions and exemptions.</p>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex gap-3 text-blue-700 dark:text-blue-300">
        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
        <div className="text-sm">
          <strong>Note on Exemptions:</strong> When a control is blocked globally, you can grant specific users an exemption.
          This UI is mocked for the Sprint 10 demo.
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {controls.map(control => (
            <div key={control.id} className="p-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  {control.action}
                  {control.isEnabled && <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full">Blocked</span>}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{control.description}</p>
                {control.isEnabled && (
                  <button onClick={() => window.alert('Exemptions UI will be built in Sprint 11.')} className="text-sm text-primary hover:underline mt-2">Manage Exemptions (0)</button>
                )}
              </div>
              <button 
                onClick={() => handleToggle(control.id, control.isEnabled)}
                className={`flex items-center justify-center p-2 rounded-full transition-colors ${control.isEnabled ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20'}`}
              >
                {control.isEnabled ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
