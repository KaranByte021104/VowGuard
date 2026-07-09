import { useState, useEffect } from 'react';
import { Users, Key, Share2, Activity, Download } from 'lucide-react';
import { useSessionStore } from '../store/session';

export function Dashboard() {
  const { user } = useSessionStore();
  const [stats, setStats] = useState<any>(null);

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
            Welcome back. Here is the activity summary for your organization.
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
            <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">Vault Secrets</h3>
            <Key className="w-5 h-5 text-green-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">{stats.passwordAccess?.total || 0}</div>
          <p className="text-sm text-gray-500 mt-2">Stored passwords & secure notes</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">Active Shares</h3>
            <Share2 className="w-5 h-5 text-purple-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">{stats.sharing?.total || 0}</div>
          <p className="text-sm text-gray-500 mt-2">Items shared internally</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">Audit Events</h3>
            <Activity className="w-5 h-5 text-orange-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">{stats.auditEvents || 0}</div>
          <p className="text-sm text-gray-500 mt-2">Total security actions logged</p>
        </div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mt-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Activity Chart</h3>
        <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
           <p className="text-gray-500">Time-series chart visualization (Sprint 12)</p>
        </div>
      </div>
    </div>
  );
}
