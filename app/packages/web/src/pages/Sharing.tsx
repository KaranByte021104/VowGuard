import toast from 'react-hot-toast';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '../components/Modal';
import { Users, UserPlus, Trash, Plus, X } from 'lucide-react';
import { apiFetch } from '../lib/apiFetch';

export function Sharing() {
  const [modalState, setModalState] = useState<{ isOpen: boolean; mode: 'create_group' | 'add_member' | 'confirm'; data?: any }>({ isOpen: false, mode: 'create_group' });
  const [selectedUserId, setSelectedUserId] = useState('');

  const { data: groups, refetch } = useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const res = await apiFetch('http://localhost:3000/groups', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch groups');
      return res.json();
    }
  });

  const { data: orgUsers } = useQuery({
    queryKey: ['orgUsers'],
    queryFn: async () => {
      const res = await apiFetch('http://localhost:3000/users', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    }
  });

  const handleCreateGroup = async (name?: string) => {
    if (!name) return;
    try {
      const res = await apiFetch('http://localhost:3000/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name })
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to create group: ${text}`);
      }
      refetch();
      setModalState({ isOpen: false, mode: 'create_group' });
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Error creating group');
    }
  };

  const handleDeleteGroup = async (id: string) => {
    try {
      const res = await apiFetch(`http://localhost:3000/groups/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error(await res.text());
      refetch();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Error deleting group');
    }
  };

  const handleAddMember = async () => {
    if (!selectedUserId || !modalState.data?.groupId) return;
    try {
      const res = await apiFetch(`http://localhost:3000/groups/${modalState.data.groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: selectedUserId })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || await res.text());
      }
      refetch();
      setSelectedUserId('');
      setModalState({ isOpen: false, mode: 'add_member' });
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Error adding member.');
    }
  };

  const handleRemoveMember = async (groupId: string, userId: string) => {
    try {
      const res = await apiFetch(`http://localhost:3000/groups/${groupId}/members/${userId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error(await res.text());
      refetch();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Error removing member');
    }
  };

  // Get members already in the selected group so we can filter them from dropdown
  const currentGroupMembers: string[] = modalState.data?.groupId
    ? (groups?.find((g: any) => g.id === modalState.data.groupId)?.members || []).map((m: any) => m.userId)
    : [];

  const availableUsers = (orgUsers || []).filter((u: any) => !currentGroupMembers.includes(u.id));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Secure Sharing &amp; Groups</h1>
        <button
          onClick={() => { setModalState({ isOpen: true, mode: 'create_group' }); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Create Group
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {!groups || groups.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No groups created yet. Click "Create Group" to get started.</div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {groups?.map((group: any) => (
              <div key={group.id} className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" /> {group.name}
                    <span className="ml-2 text-xs font-normal text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                      {group.members.length} member{group.members.length !== 1 ? 's' : ''}
                    </span>
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setSelectedUserId(''); setModalState({ isOpen: true, mode: 'add_member', data: { groupId: group.id, groupName: group.name } }); }}
                      className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md flex items-center gap-1"
                    >
                      <UserPlus className="w-4 h-4" /> Add Member
                    </button>
                    <button
                      onClick={() => handleDeleteGroup(group.id)}
                      className="text-sm p-1.5 text-red-600 hover:bg-red-50 rounded-md"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {group.members.length > 0 ? (
                  <ul className="space-y-2 pl-7">
                    {group.members.map((m: any) => (
                      <li key={m.userId} className="flex justify-between items-center text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 p-2 rounded-md">
                        <span className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold uppercase">
                            {m.user.email[0]}
                          </span>
                          {m.user.email}
                        </span>
                        <button onClick={() => handleRemoveMember(group.id, m.userId)} className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1">
                          <X className="w-3 h-3" /> Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500 pl-7 italic">No members in this group. Add members to start sharing secrets.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      {modalState.isOpen && modalState.mode === 'create_group' && (
        <Modal
          isOpen={true}
          mode="prompt"
          title="Create New Group"
          message="Enter a name for the new user group:"
          onClose={() => setModalState({ isOpen: false, mode: 'create_group' })}
          onConfirm={handleCreateGroup}
          confirmText="Create Group"
        />
      )}

      {/* Add Member Modal - custom dropdown */}
      {modalState.isOpen && modalState.mode === 'add_member' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Add Member to <span className="text-primary">"{modalState.data?.groupName}"</span>
              </h2>
              <button onClick={() => setModalState({ isOpen: false, mode: 'add_member' })} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Select an organisation member to add to this group.
            </p>

            {availableUsers.length === 0 ? (
              <p className="text-sm text-center text-gray-400 py-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                All organisation members are already in this group.
              </p>
            ) : (
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary outline-none"
              >
                <option value="">— Select a member —</option>
                {availableUsers.map((u: any) => (
                  <option key={u.id} value={u.id}>
                    {u.email} ({u.role})
                  </option>
                ))}
              </select>
            )}

            <div className="flex gap-3 mt-5 justify-end">
              <button
                onClick={() => setModalState({ isOpen: false, mode: 'add_member' })}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMember}
                disabled={!selectedUserId}
                className="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" /> Add Member
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
