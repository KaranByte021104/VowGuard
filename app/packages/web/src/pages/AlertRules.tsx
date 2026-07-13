import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, Plus, Clock, Zap, Settings } from 'lucide-react';
import { Modal } from '../components/Modal';
import { apiFetch } from '../lib/apiFetch';

export function AlertRules() {
  const { data: rules, refetch, isLoading } = useQuery({
    queryKey: ['alertRules'],
    queryFn: async () => {
      const res = await apiFetch('http://localhost:3000/alerts/rules', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch rules');
      return res.json();
    }
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);

  if (isLoading) return <div>Loading alert rules...</div>;

  const handleOpenModal = (rule?: any) => {
    setEditingRule(rule || null);
    setIsModalOpen(true);
  };

  const handleSaveRule = async (e: any) => {
    e.preventDefault();
    try {
      const formData = new FormData(e.target);
      const data = {
        id: editingRule?.id,
        name: formData.get('name'),
        eventType: formData.get('eventType') ? [formData.get('eventType')] : [],
        timing: formData.get('timing'),
        recipientType: formData.get('recipientType'),
      };
      
      const res = await apiFetch('http://localhost:3000/alerts/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      
      if (!res.ok) throw new Error(await res.text());
      refetch();
      setIsModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Error saving rule');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <Bell className="w-8 h-8 text-primary" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Alert Rules</h2>
            <p className="text-gray-500 dark:text-gray-400">Configure automated notifications for critical audit events.</p>
          </div>
        </div>
        <button onClick={() => handleOpenModal()} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" />
          New Rule
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rule Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Event Trigger</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timing</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recipients</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {(rules || []).map((rule: any) => (
              <tr key={rule.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{rule.name}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500 dark:text-gray-400 font-mono bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded inline-block">
                    {rule.eventTypes?.[0] || rule.eventType}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    rule.timing === 'INSTANT' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                  }`}>
                    {rule.timing === 'INSTANT' ? <Zap className="w-3 h-3 mr-1 mt-0.5" /> : <Clock className="w-3 h-3 mr-1 mt-0.5" />}
                    {rule.timing}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {rule.recipients}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end gap-3">
                    <div className={`h-2.5 w-2.5 rounded-full ${rule.enabled ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                    <button onClick={() => handleOpenModal(rule)} className="text-gray-400 hover:text-gray-500 transition-colors">
                      <Settings className="w-5 h-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingRule ? "Edit Alert Rule" : "Create Alert Rule"}
        mode="custom"
      >
        <form onSubmit={handleSaveRule} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rule Name</label>
            <input 
              type="text" 
              name="name"
              defaultValue={editingRule?.name || ''}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="e.g. Failed Login Alert"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Event Trigger</label>
            <select name="eventType" className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white">
              <option value="LOGIN_FAILED">Login Failed</option>
              <option value="BACKUP_FAILED">Backup Failed</option>
              <option value="THIRD_PARTY_INVITE_CREATED">External Share Created</option>
              <option value="SECRET_DELETED">Secret Deleted</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Timing</label>
            <select name="timing" className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white">
              <option value="INSTANT">Instant (Email/Slack)</option>
              <option value="DAILY_DIGEST">Daily Digest</option>
              <option value="WEEKLY_DIGEST">Weekly Digest</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Save Rule
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
