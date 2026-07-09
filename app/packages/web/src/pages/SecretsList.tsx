import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Key, Server, Globe, Box, Folder, Download, Edit2, Trash2 } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useSessionStore } from '../store/session';
import { decryptSecretPayload, decryptItemKeyWithPrivateKey } from '@app/shared/src/crypto';

function getIconForTemplate(type: string) {
  switch (type) {
    case 'WEBSITE': return <Globe className="w-5 h-5" />;
    case 'SERVER': return <Server className="w-5 h-5" />;
    case 'LICENSE': return <Key className="w-5 h-5" />;
    default: return <Box className="w-5 h-5" />;
  }
}

export function SecretsList() {
  const { privateKey } = useSessionStore();
  const [decryptedSecrets, setDecryptedSecrets] = useState<Record<string, any>>({});
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedSecretIds, setSelectedSecretIds] = useState<string[]>([]);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, title: string, message?: string, mode?: 'confirm' | 'prompt', promptPlaceholder?: string, onConfirm: (v?: string) => void, confirmColor?: 'red' | 'primary', confirmText?: string }>({ isOpen: false, title: '', onConfirm: () => {} });

  const { data: secrets, isLoading, refetch } = useQuery({
    queryKey: ['secrets'],
    queryFn: async () => {
      const res = await fetch('http://localhost:3000/secrets', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch secrets');
      return res.json();
    }
  });

  const { data: folders, refetch: refetchFolders } = useQuery({
    queryKey: ['folders'],
    queryFn: async () => {
      const res = await fetch('http://localhost:3000/folders', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch folders');
      return res.json();
    }
  });

  const handleCreateFolder = () => {
    setConfirmModal({
      isOpen: true,
      mode: 'prompt',
      title: 'Create Folder',
      promptPlaceholder: 'Folder Name',
      confirmText: 'Create',
      onConfirm: async (name) => {
        if (!name) return;
        await fetch('http://localhost:3000/folders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
          credentials: 'include'
        });
        refetchFolders();
      }
    });
  };

  const handleRenameFolder = (folderId: string, currentName: string) => {
    setConfirmModal({
      isOpen: true,
      mode: 'prompt',
      title: 'Rename Folder',
      promptPlaceholder: currentName,
      confirmText: 'Rename',
      onConfirm: async (name) => {
        if (!name) return;
        await fetch(`http://localhost:3000/folders/${folderId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
          credentials: 'include'
        });
        refetchFolders();
      }
    });
  };

  const handleDeleteFolder = (folderId: string) => {
    setConfirmModal({
      isOpen: true,
      mode: 'confirm',
      title: 'Delete Folder',
      message: 'Are you sure you want to delete this folder?',
      confirmText: 'Delete',
      confirmColor: 'red',
      onConfirm: async () => {
        await fetch(`http://localhost:3000/folders/${folderId}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        if (selectedFolderId === folderId) setSelectedFolderId(null);
        refetchFolders();
      }
    });
  };

  const handleBulkMove = async (folderId: string) => {
    if (selectedSecretIds.length === 0) return;
    await fetch(`http://localhost:3000/folders/${folderId}/secrets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secretIds: selectedSecretIds }),
      credentials: 'include'
    });
    setSelectedSecretIds([]);
    refetch(); 
  };

  const handleExport = async () => {
    if (!secrets || !privateKey) return;
    // Client-side decryption for export
    const decryptedData = await Promise.all(secrets.map(async (secret: any) => {
      try {
        const encryptedItemKeyBuf = Uint8Array.from(atob(secret.encryptedItemKey), c => c.charCodeAt(0)).buffer;
        const itemKey = await decryptItemKeyWithPrivateKey(encryptedItemKeyBuf, privateKey);
        
        const encryptedDataBuf = Uint8Array.from(atob(secret.encryptedData), c => c.charCodeAt(0)).buffer;
        const ivBuf = Uint8Array.from(atob(secret.iv), c => c.charCodeAt(0));
        
        const payload = await decryptSecretPayload(encryptedDataBuf, ivBuf, itemKey);
        return { name: secret.name, domain: secret.domain, ...payload };
      } catch (e) {
        return { name: secret.name, error: 'Decryption failed' };
      }
    }));
    
    const jsonStr = JSON.stringify(decryptedData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vault_export.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Decrypt all secrets
  React.useEffect(() => {
    async function decryptAll() {
      if (!secrets || !privateKey) return;
      const decrypted: Record<string, any> = {};
      for (const secret of secrets) {
        try {
          const encryptedItemKeyBuf = Uint8Array.from(atob(secret.encryptedItemKey), c => c.charCodeAt(0)).buffer;
          const itemKey = await decryptItemKeyWithPrivateKey(encryptedItemKeyBuf, privateKey);
          
          const encryptedDataBuf = Uint8Array.from(atob(secret.encryptedData), c => c.charCodeAt(0)).buffer;
          const ivBuf = Uint8Array.from(atob(secret.iv), c => c.charCodeAt(0));
          
          const payload = await decryptSecretPayload(encryptedDataBuf, ivBuf, itemKey);
          decrypted[secret.id] = payload;
        } catch (e) {
          console.error('Failed to decrypt secret', secret.id, e);
          decrypted[secret.id] = { error: 'Decryption failed' };
        }
      }
      setDecryptedSecrets(decrypted);
    }
    decryptAll();
  }, [secrets, privateKey]);

  if (!privateKey) {
    return (
      <div className="p-8 text-center bg-yellow-50 rounded-lg">
        <h2 className="text-xl font-bold text-yellow-800">Vault Locked</h2>
        <p className="mt-2 text-yellow-700">Please unlock your vault to view secrets.</p>
        {/* Sprint 3 temporary fix: Reload to prompt login if missing key */}
        <button onClick={() => window.location.href = '/login'} className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded">
          Unlock Vault
        </button>
      </div>
    );
  }

  const handleDelete = (id: string) => {
    setConfirmModal({
      isOpen: true,
      mode: 'confirm',
      title: selectedFolderId ? 'Remove from Folder' : 'Delete Secret',
      message: selectedFolderId 
        ? 'Remove this secret from the folder? It will still be available in "All Secrets".'
        : 'Are you sure you want to permanently delete this secret?',
      confirmText: selectedFolderId ? 'Remove' : 'Delete',
      confirmColor: 'red',
      onConfirm: async () => {
        if (selectedFolderId) {
          // Remove from folder only
          await fetch(`http://localhost:3000/folders/${selectedFolderId}/secrets/${id}`, {
            method: 'DELETE',
            credentials: 'include'
          });
        } else {
          // Hard delete globally
          await fetch(`http://localhost:3000/secrets/${id}`, {
            method: 'DELETE',
            credentials: 'include'
          });
        }
        refetch();
      }
    });
  };

  const filteredSecrets = secrets?.filter((s: any) => {
    if (!selectedFolderId) return true;
    return s.folders?.some((f: any) => f.folderId === selectedFolderId);
  }) || [];

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Secrets Vault</h1>
        <div className="flex gap-4">
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
            <Download className="w-4 h-4" /> Export Vault
          </button>
          <Link to="/import" className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
            Import CSV
          </Link>
          <Link to={`/secrets/new${selectedFolderId ? `?folderId=${selectedFolderId}` : ''}`} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Add Secret
          </Link>
        </div>
      </div>

      <div className="flex gap-8">
        <div className="w-64 flex-shrink-0">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Folders</h2>
            <button onClick={handleCreateFolder} className="text-gray-500 hover:text-gray-700">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <ul className="space-y-2">
            <li>
              <button onClick={() => setSelectedFolderId(null)} className={`flex w-full items-center gap-2 font-medium px-2 py-1 rounded ${!selectedFolderId ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}>
                <Folder className="w-4 h-4" /> All Secrets
              </button>
            </li>
            {folders?.map((folder: any) => (
              <li key={folder.id} className="group flex items-center justify-between">
                <button onClick={() => setSelectedFolderId(folder.id)} className={`flex flex-1 items-center gap-2 px-2 py-1 rounded text-left truncate ${selectedFolderId === folder.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                  <Folder className="w-4 h-4 flex-shrink-0" /> <span className="truncate">{folder.name}</span>
                </button>
                <div className="hidden group-hover:flex items-center gap-1">
                  <button onClick={() => handleRenameFolder(folder.id, folder.name)} className="p-1 text-gray-400 hover:text-blue-600"><Edit2 className="w-3 h-3" /></button>
                  <button onClick={() => handleDeleteFolder(folder.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                </div>
              </li>
            ))}
          </ul>
        </div>
        
        <div className="flex-grow">
          {selectedSecretIds.length > 0 && (
            <div className="mb-4 flex items-center gap-4 bg-blue-50 p-3 rounded-lg border border-blue-100">
              <span className="text-sm font-medium text-blue-800">{selectedSecretIds.length} selected</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-blue-600">Move to:</span>
                <select 
                  className="text-sm border-gray-300 rounded-md p-1"
                  onChange={(e) => {
                    if(e.target.value) handleBulkMove(e.target.value);
                    e.target.value = '';
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>Select folder...</option>
                  {folders?.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            </div>
          )}

      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-6 py-3 text-left w-12">
                  <input type="checkbox" className="rounded border-gray-300"
                    checked={filteredSecrets.length > 0 && selectedSecretIds.length === filteredSecrets.length}
                    onChange={(e) => setSelectedSecretIds(e.target.checked ? filteredSecrets.map((s:any) => s.id) : [])}
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredSecrets.map((secret: any) => (
                <tr key={secret.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input type="checkbox" className="rounded border-gray-300"
                      checked={selectedSecretIds.includes(secret.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedSecretIds([...selectedSecretIds, secret.id]);
                        else setSelectedSecretIds(selectedSecretIds.filter(id => id !== secret.id));
                      }}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-500">
                        {getIconForTemplate(secret.templateType)}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{secret.name}</div>
                        <div className="text-sm text-gray-500">{secret.domain}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-gray-300">
                      {decryptedSecrets[secret.id]?.username || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link to={`/secrets/${secret.id}`} className="text-primary hover:text-blue-900 mr-4">View</Link>
                    <button onClick={() => handleDelete(secret.id)} className="text-red-600 hover:text-red-900">
                      {selectedFolderId ? 'Remove' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
              {filteredSecrets.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    No secrets found in this folder.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </div>
    
      <Modal 
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        title={confirmModal.title}
        message={confirmModal.message}
        mode={confirmModal.mode}
        promptPlaceholder={confirmModal.promptPlaceholder}
        confirmText={confirmModal.confirmText}
        confirmColor={confirmModal.confirmColor}
        onConfirm={confirmModal.onConfirm}
      />
    </div>
  );
}
