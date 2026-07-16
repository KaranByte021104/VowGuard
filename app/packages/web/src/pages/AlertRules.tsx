import toast from 'react-hot-toast';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, Plus, Clock, Zap, Settings } from 'lucide-react';
import { Modal } from '../components/Modal';
import { apiFetch } from '../lib/apiFetch';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';

export function AlertRules() {
  const { data: rules, refetch, isLoading } = useQuery({
    queryKey: ['alertRules'],
    queryFn: async () => {
      const res = await apiFetch('http://localhost:3000/alerts/rules', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch rules');
      return res.json();
    }
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await apiFetch('http://localhost:3000/users', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    }
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [recipientType, setRecipientType] = useState('ALL_ADMINS');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  if (isLoading) return <div>Loading alert rules...</div>;

  const handleOpenModal = (rule?: any) => {
    setEditingRule(rule || null);
    setRecipientType(rule?.recipientType || 'ALL_ADMINS');
    setSelectedUsers(rule?.specificUsers?.map((su: any) => su.userId) || []);
    setIsModalOpen(true);
  };

  const handleSaveRule = async (e: any) => {
    e.preventDefault();

    if (recipientType === 'SPECIFIC_USERS' && selectedUsers.length === 0) {
      toast.error('Please select at least one user');
      return;
    }

    try {
      const formData = new FormData(e.target);
      const data = {
        id: editingRule?.id,
        name: formData.get('name'),
        eventTypes: formData.get('eventType') ? [formData.get('eventType')] : [],
        timing: formData.get('timing'),
        recipientType: recipientType,
        specificUsers: selectedUsers,
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
      toast.error(err.message || 'Error saving rule');
    }
  };

  const handleToggle = async (rule: any) => {
    try {
      const res = await apiFetch('http://localhost:3000/alerts/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...rule, isEnabled: !rule.isEnabled })
      });
      if (!res.ok) throw new Error('Failed to toggle rule');
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <Bell className="w-8 h-8 text-primary" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Alert Rules</h2>
            <p className="text-gray-500 dark:text-gray-400">Configure automated notifications for critical audit events.</p>
          </div>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="w-4 h-4 mr-2" />
          New Rule
        </Button>
      </div>

      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Rule Name</TableHead>
              <TableHead>Event Trigger</TableHead>
              <TableHead>Timing</TableHead>
              <TableHead>Recipients</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(rules || []).map((rule: any) => (
              <TableRow key={rule.id}>
                <TableCell>
                  <div className="text-sm font-medium text-foreground">{rule.name}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-mono text-muted-foreground">
                    {rule.eventTypes?.[0] || rule.eventType}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={rule.timing === 'INSTANT' ? 'destructive' : 'secondary'} className={rule.timing === 'INSTANT' ? 'bg-orange-500 hover:bg-orange-600 text-white border-0' : ''}>
                    {rule.timing === 'INSTANT' ? <Zap className="w-3 h-3 mr-1" /> : <Clock className="w-3 h-3 mr-1" />}
                    {rule.timing}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {rule.recipientType === 'ALL_ADMINS' 
                    ? 'All Admins' 
                    : (rule.specificUsers?.length > 0 
                        ? rule.specificUsers.map((su: any) => su.user?.name || su.user?.email).join(', ') 
                        : 'Specific Users (None selected)')}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-3">
                    <button 
                      onClick={() => handleToggle(rule)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${rule.isEnabled ? 'bg-status-success' : 'bg-muted'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${rule.isEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
                    </button>
                    <Button variant="ghost" size="icon" onClick={() => handleOpenModal(rule)}>
                      <Settings className="w-5 h-5 text-muted-foreground" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingRule ? "Edit Alert Rule" : "Create Alert Rule"}
        mode="custom"
      >
        <form onSubmit={handleSaveRule} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Rule Name</label>
            <Input 
              type="text" 
              name="name"
              defaultValue={editingRule?.name || ''}
              placeholder="e.g. Failed Login Alert"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Event Trigger</label>
            <select name="eventType" defaultValue={editingRule?.eventTypes?.[0] || 'LOGIN_FAILED'} className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
              <option value="LOGIN_FAILED">Login Failed</option>
              <option value="BACKUP_FAILED">Backup Failed</option>
              <option value="THIRD_PARTY_INVITE_CREATED">External Share Created</option>
              <option value="SECRET_DELETED">Secret Deleted</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Timing</label>
            <select name="timing" defaultValue={editingRule?.timing || 'INSTANT'} className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
              <option value="INSTANT">Instant (Email/Slack)</option>
              <option value="DAILY_DIGEST">Daily Digest</option>
              <option value="WEEKLY_DIGEST">Weekly Digest</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Recipients</label>
            <select 
              name="recipientType" 
              value={recipientType}
              onChange={(e) => setRecipientType(e.target.value)}
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="ALL_ADMINS">All Admins</option>
              <option value="SPECIFIC_USERS">Specific Users</option>
            </select>
          </div>
          {recipientType === 'SPECIFIC_USERS' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Select Users</label>
              <div className="max-h-40 overflow-y-auto border border-border rounded-lg p-2 space-y-2 bg-card">
                {(users || []).map((u: any) => (
                  <label key={u.id} className="flex items-center gap-2 cursor-pointer p-1 hover:bg-muted/50 rounded">
                    <input 
                      type="checkbox" 
                      checked={selectedUsers.includes(u.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedUsers([...selectedUsers, u.id]);
                        else setSelectedUsers(selectedUsers.filter(id => id !== u.id));
                      }}
                      className="rounded text-primary focus:ring-primary w-4 h-4"
                    />
                    <span className="text-sm text-foreground">{u.name || u.email}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-6 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit">
              Save Rule
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
