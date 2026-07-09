import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '../components/Modal';
import { Users, UserPlus, Trash, Plus } from 'lucide-react';

export function Sharing() {
  const [modalState, setModalState] = useState<{ isOpen: boolean; mode: 'create_group' | 'add_member' | 'confirm'; data?: any }>({ isOpen: false, mode: 'create_group' });

  const { data: groups, refetch } = useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const res = await fetch('http://localhost:3000/groups', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch groups');
      return res.json();
    }
  });

  const handleCreateGroup = async (name?: string) => {
    if (!name) return;
    try {
      const res = await fetch('http://localhost:3000/groups', {
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
      alert(e.message || 'Error creating group');
    }
  };

  const handleDeleteGroup = async (id: string) => {
    try {
      const res = await fetch(`http://localhost:3000/groups/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error(await res.text());
      refetch();
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Error deleting group');
    }
  };

  // For adding members, we would typically have a user selector. For now, simple text input for User ID
  const handleAddMember = async (userId?: string) => {
    if (!userId || !modalState.data?.groupId) return;
    try {
      const res = await fetch(`http://localhost:3000/groups/${modalState.data.groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId })
      });
      if (!res.ok) throw new Error(await res.text());
      refetch();
      setModalState({ isOpen: false, mode: 'add_member' });
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Error adding member. Ensure User ID is correct.');
    }
  };

  const handleRemoveMember = async (groupId: string, userId: string) => {
    try {
      const res = await fetch(`http://localhost:3000/groups/${groupId}/members/${userId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error(await res.text());
      refetch();
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Error removing member');
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Secure Sharing & Groups</h1>
        <button
          onClick={() => { setModalState({ isOpen: true, mode: 'create_group' }); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Create Group
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {groups?.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No groups created yet.</div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {groups?.map((group: any) => (
              <div key={group.id} className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" /> {group.name}
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setModalState({ isOpen: true, mode: 'add_member', data: { groupId: group.id } }); }}
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
                        <span>{m.user.email}</span>
                        <button onClick={() => handleRemoveMember(group.id, m.userId)} className="text-red-500 hover:text-red-700 text-xs">Remove</button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500 pl-7 italic">No members in this group.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

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

      {modalState.isOpen && modalState.mode === 'add_member' && (
        <Modal
          isOpen={true}
          mode="prompt"
          title="Add Member to Group"
          message="Enter the User ID of the member you want to add:"
          onClose={() => setModalState({ isOpen: false, mode: 'create_group' })}
          onConfirm={handleAddMember}
          confirmText="Add Member"
        />
      )}
    </div>
  );
}
