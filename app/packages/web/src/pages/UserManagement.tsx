import { useState, useEffect } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { useSessionStore } from '../store/session';

export function UserManagement() {
  const { user } = useSessionStore();
  const [users, setUsers] = useState<any[]>([]);
  const [error, setError] = useState<string>('');

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [inviteError, setInviteError] = useState('');

  const fetchUsers = () => {
    fetch('http://localhost:3000/users', { credentials: 'include' })
      .then(res => res.json())
      .then(setUsers)
      .catch(console.error);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (targetUserId: string, newRole: string) => {
    setError('');
    try {
      const res = await fetch(`http://localhost:3000/users/${targetUserId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role: newRole })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to update role');
      }
      
      fetchUsers();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleRemoveUser = async (targetUserId: string) => {
    if (!window.confirm('Are you sure you want to completely remove this user from the organization? This action cannot be undone.')) {
      return;
    }
    
    setError('');
    try {
      const res = await fetch(`http://localhost:3000/users/${targetUserId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to remove user');
      }
      
      fetchUsers();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError('');
    setInviteSuccess('');
    try {
      const res = await fetch('http://localhost:3000/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: inviteEmail })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create invite');
      
      setInviteSuccess(data.message);
    } catch (e: any) {
      setInviteError(e.message);
    }
  };

  if (user?.role !== 'SUPER_ADMIN' && user?.role !== 'ADMIN') {
    return <div className="p-8 text-center text-red-500">Access Denied. Administrators only.</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <UsersIcon className="w-8 h-8 text-primary" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">User Management</h2>
            <p className="text-gray-500 dark:text-gray-400">Manage user roles and permissions within your organization.</p>
          </div>
        </div>
        <button 
          onClick={() => { setInviteModalOpen(true); setInviteSuccess(''); setInviteEmail(''); }}
          className="bg-primary text-white px-4 py-2 rounded shadow text-sm font-medium hover:bg-blue-600 transition"
        >
          Invite User
        </button>
      </div>

      {inviteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Invite New User</h3>
            {inviteSuccess ? (
              <div className="space-y-4">
                <p className="text-sm text-green-600 font-medium">{inviteSuccess}</p>
                <button onClick={() => setInviteModalOpen(false)} className="w-full bg-gray-200 text-gray-800 py-2 rounded text-sm font-medium hover:bg-gray-300">Close</button>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="space-y-4">
                {inviteError && <div className="text-red-600 text-sm">{inviteError}</div>}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Address</label>
                  <input type="email" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm" placeholder="user@example.com" />
                </div>
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setInviteModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">Cancel</button>
                  <button type="submit" className="bg-primary text-white px-4 py-2 rounded shadow text-sm font-medium hover:bg-blue-600 transition">Send Invite</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex gap-3 text-red-700 dark:text-red-400 mb-6">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <div className="text-sm font-medium">{error}</div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-6 py-4 font-semibold text-sm text-gray-600 dark:text-gray-300">Email</th>
              <th className="px-6 py-4 font-semibold text-sm text-gray-600 dark:text-gray-300">Status</th>
              <th className="px-6 py-4 font-semibold text-sm text-gray-600 dark:text-gray-300">Role</th>
              <th className="px-6 py-4 font-semibold text-sm text-gray-600 dark:text-gray-300 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-750/50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                      {u.email[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        {u.email}
                        {u.id === user.id && <span className="px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">You</span>}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    u.status === 'ACTIVE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}>
                    {u.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    disabled={user.role === 'ADMIN' && u.role === 'SUPER_ADMIN'}
                    className="border border-gray-300 dark:border-gray-600 rounded p-1.5 bg-white dark:bg-gray-700 text-sm dark:text-white disabled:opacity-50"
                  >
                    <option value="USER">User</option>
                    <option value="ADMIN">Admin</option>
                    <option value="SUPER_ADMIN" disabled={user.role !== 'SUPER_ADMIN'}>Super Admin</option>
                  </select>
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => handleRemoveUser(u.id)}
                    disabled={u.id === user.id || (user.role === 'ADMIN' && u.role === 'SUPER_ADMIN')}
                    className="text-red-500 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors inline-flex"
                    title="Remove User"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UsersIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/-2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
