import { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, Mail } from 'lucide-react';
import { useSessionStore } from '../store/session';
import { apiFetch } from '../lib/apiFetch';
import { Modal } from '../components/Modal';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';

export function UserManagement() {
  const { user } = useSessionStore();
  const [users, setUsers] = useState<any[]>([]);
  const [error, setError] = useState<string>('');

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [inviteError, setInviteError] = useState('');

  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void}>({
    isOpen: false, title: '', message: '', onConfirm: () => {}
  });

  const fetchUsers = () => {
    apiFetch('http://localhost:3000/users', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setUsers(data);
        } else {
          setUsers([]);
          setError(data.message || 'Failed to load users');
        }
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (targetUserId: string, newRole: string) => {
    setError('');
    try {
      const res = await apiFetch(`http://localhost:3000/users/${targetUserId}/role`, {
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
    setConfirmModal({
      isOpen: true,
      title: 'Remove User',
      message: 'Are you sure you want to completely remove this user from the organization? This action cannot be undone.',
      onConfirm: async () => {
        setError('');
        try {
          const res = await apiFetch(`http://localhost:3000/users/${targetUserId}`, {
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
      }
    });
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError('');
    setInviteSuccess('');
    try {
      const res = await apiFetch('http://localhost:3000/invitations', {
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
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <UsersIcon className="w-8 h-8 text-primary" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">User Management</h2>
            <p className="text-gray-500 dark:text-gray-400">Manage user roles and permissions within your organization.</p>
          </div>
        </div>
        <Button 
          onClick={() => { setInviteModalOpen(true); setInviteSuccess(''); setInviteEmail(''); }}
        >
          <Mail className="w-4 h-4 mr-2" /> Invite User
        </Button>
      </div>

      {inviteModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-lg shadow-lg w-full max-w-md border border-border">
            <h3 className="text-lg font-semibold text-foreground mb-4">Invite New User</h3>
            {inviteSuccess ? (
              <div className="space-y-4">
                <p className="text-sm text-status-success font-medium">{inviteSuccess}</p>
                <Button onClick={() => setInviteModalOpen(false)} className="w-full" variant="outline">Close</Button>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="space-y-4">
                {inviteError && <div className="text-status-danger text-sm">{inviteError}</div>}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Email Address</label>
                  <Input type="email" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="user@example.com" />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="ghost" onClick={() => setInviteModalOpen(false)}>Cancel</Button>
                  <Button type="submit">Send Invite</Button>
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

      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(u => (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                      {u.email?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div>
                      <div className="font-medium text-foreground flex items-center gap-2">
                        {u.email || 'Unknown User'}
                        {u.id === user?.id && <Badge variant="secondary">You</Badge>}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={u.status === 'ACTIVE' ? 'default' : 'secondary'} className={u.status === 'ACTIVE' ? 'bg-status-success hover:bg-status-success/80' : ''}>
                    {u.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Select
                    value={u.role}
                    onValueChange={(val) => handleRoleChange(u.id, val)}
                    disabled={user.role === 'ADMIN' && u.role === 'SUPER_ADMIN'}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USER">User</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="SUPER_ADMIN" disabled={user.role !== 'SUPER_ADMIN'}>Super Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveUser(u.id)}
                    disabled={u.id === user.id || (user.role === 'ADMIN' && u.role === 'SUPER_ADMIN')}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    title="Remove User"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="Remove User"
        confirmColor="red"
        onConfirm={confirmModal.onConfirm}
      />
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
