import { useState, useEffect } from 'react';
import { Users, Key, Share2, Activity, Download } from 'lucide-react';
import { useSessionStore } from '../store/session';

export function Dashboard() {
  const { user } = useSessionStore();
  const [stats, setStats] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'personal' | 'team'>('personal');

  useEffect(() => {
    fetch('http://localhost:3000/reports', {
      credentials: 'include'
    }).then(res => res.json()).then(setStats).catch(console.error);
  }, []);

  const handleExport = (format: 'csv' | 'pdf') => {
    window.location.href = `http://localhost:3000/reports/export?format=${format}`;
  };

  if (!stats) return <div className="p-8 text-center text-gray-500">Loading dashboard...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Overview</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Welcome back. Here is the activity summary for your account and organization.
          </p>
        </div>
        
        {user?.role !== 'USER' && (
          <div className="flex gap-3">
            <button
              onClick={() => handleExport('csv')}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={() => handleExport('pdf')}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Export PDF
            </button>
          </div>
        )}
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('personal')}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'personal'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Personal Vault
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'team'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Team Workspace
          </button>
        </nav>
      </div>

      {activeTab === 'team' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Stat Cards */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">Total Users</h3>
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">{stats.userAccess?.total || 0}</div>
            <p className="text-sm text-gray-500 mt-2">Active members in organization</p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">Total Secrets</h3>
              <Key className="w-5 h-5 text-purple-500" />
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">{stats.passwordAccess?.total || 0}</div>
            <p className="text-sm text-gray-500 mt-2">Passwords & documents stored</p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">Active Shares</h3>
              <Share2 className="w-5 h-5 text-green-500" />
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">{stats.sharing?.total || 0}</div>
            <p className="text-sm text-gray-500 mt-2">Items shared across team</p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">Audit Events</h3>
              <Activity className="w-5 h-5 text-orange-500" />
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">{stats.auditEvents || 0}</div>
            <p className="text-sm text-gray-500 mt-2">Security events logged</p>
          </div>

          <div className="lg:col-span-4 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mt-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Recent Audit Activity</h3>
            {stats.recentActivity?.length > 0 ? (
              <table className="min-w-full text-left">
                <thead>
                  <tr className="border-b dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
                    <th className="pb-3">Event</th>
                    <th className="pb-3">User</th>
                    <th className="pb-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentActivity.map((log: any) => (
                    <tr key={log.id} className="border-b dark:border-gray-700 text-sm dark:text-gray-300">
                      <td className="py-3">{log.action}</td>
                      <td className="py-3">{log.userId}</td>
                      <td className="py-3">{new Date(log.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-gray-500 dark:text-gray-400">No recent activity.</div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">My Secrets</h3>
              <Key className="w-5 h-5 text-purple-500" />
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">{stats.personalSecrets || 0}</div>
            <p className="text-sm text-gray-500 mt-2">Items in personal vault</p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">Shared With Me</h3>
              <Share2 className="w-5 h-5 text-green-500" />
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">{stats.sharedWithMe || 0}</div>
            <p className="text-sm text-gray-500 mt-2">Items accessible from others</p>
          </div>
        </div>
      )}
      
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mt-6">
        <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Activity Breakdown</h3>
        
        <div className="mb-6">
          <span className="text-5xl font-bold text-gray-900 dark:text-white">
            {stats.auditEvents || 0}
          </span>
          <span className="text-lg text-gray-500 ml-2">Total Events Logged</span>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1 text-gray-700 dark:text-gray-300">
              <span>Logins</span>
              <span className="font-medium">65%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
              <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: '65%' }}></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1 text-gray-700 dark:text-gray-300">
              <span>Secret Access</span>
              <span className="font-medium">25%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
              <div className="bg-emerald-500 h-2.5 rounded-full" style={{ width: '25%' }}></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1 text-gray-700 dark:text-gray-300">
              <span>Settings Changes</span>
              <span className="font-medium">10%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
              <div className="bg-amber-500 h-2.5 rounded-full" style={{ width: '10%' }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
