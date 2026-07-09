import { useState } from 'react';
import { Bell, Plus, Clock, Zap, Settings } from 'lucide-react';

export function AlertRules() {
  const [rules, setRules] = useState([
    { id: '1', name: 'Failed Backups', eventType: 'BACKUP_FAILED', timing: 'INSTANT', recipients: 'All Admins', enabled: true },
    { id: '2', name: 'External Shares', eventType: 'THIRD_PARTY_INVITE_CREATED', timing: 'DAILY_DIGEST', recipients: 'Specific Users', enabled: true },
  ]);

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
        <button onClick={() => window.alert('New Rule creation will be built in Sprint 11.')} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition-colors">
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
            {rules.map((rule) => (
              <tr key={rule.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{rule.name}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500 dark:text-gray-400 font-mono bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded inline-block">
                    {rule.eventType}
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
                    <button onClick={() => window.alert('Rule Configuration will be built in Sprint 11.')} className="text-gray-400 hover:text-gray-500 transition-colors">
                      <Settings className="w-5 h-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
