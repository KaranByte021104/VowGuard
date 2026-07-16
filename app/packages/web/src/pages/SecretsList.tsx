import toast from 'react-hot-toast';
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Key, Server, Globe, Box, Folder, Download, Edit2, Trash2, Share2 } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useSessionStore } from '../store/session';
import { decryptSecretPayload, decryptItemKeyWithPrivateKey, encryptItemKeyWithPublicKey, importPublicKey } from '@app/shared/src/crypto';
import { apiFetch } from '../lib/apiFetch';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

function getIconForTemplate(type: string) {
  switch (type) {
    case 'WEBSITE': return <Globe className="w-5 h-5" />;
    case 'SERVER': return <Server className="w-5 h-5" />;
    case 'LICENSE': return <Key className="w-5 h-5" />;
    default: return <Box className="w-5 h-5" />;
  }
}

export function SecretsList() {
  const { user, privateKey } = useSessionStore();
  const navigate = useNavigate();
  const [decryptedSecrets, setDecryptedSecrets] = useState<Record<string, any>>({});
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedSecretIds, setSelectedSecretIds] = useState<string[]>([]);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, title: string, message?: string, mode?: 'confirm' | 'prompt', promptPlaceholder?: string, onConfirm: (v?: string) => void, confirmColor?: 'red' | 'primary', confirmText?: string }>({ isOpen: false, title: '', onConfirm: () => {} });
  const [shareFolderModal, setShareFolderModal] = useState<{ isOpen: boolean, folderId: string, folderName: string }>({ isOpen: false, folderId: '', folderName: '' });
  const [revokeModal, setRevokeModal] = useState({ isOpen: false, folderId: '', recipientId: '' });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await apiFetch('http://localhost:3000/users', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    }
  });

  const { data: secrets, isLoading, refetch } = useQuery({
    queryKey: ['secrets'],
    queryFn: async () => {
      const res = await apiFetch('http://localhost:3000/secrets', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch secrets');
      return res.json();
    }
  });

  const { data: folders, refetch: refetchFolders } = useQuery({
    queryKey: ['folders'],
    queryFn: async () => {
      const res = await apiFetch('http://localhost:3000/folders', { credentials: 'include' });
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
        await apiFetch('http://localhost:3000/folders', {
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
        await apiFetch(`http://localhost:3000/folders/${folderId}`, {
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
        await apiFetch(`http://localhost:3000/folders/${folderId}`, {
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
    await apiFetch(`http://localhost:3000/folders/${folderId}/secrets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secretIds: selectedSecretIds }),
      credentials: 'include'
    });
    setSelectedSecretIds([]);
    refetch(); 
  };

  const submitFolderShare = async (recipientUserId: string, permission: string) => {
    try {
      const folder = folders?.find((f: any) => f.id === shareFolderModal.folderId);
      if (!folder || !folder.secrets || folder.secrets.length === 0) {
         // Even if it's empty, we could theoretically share it, but the endpoint expects encryptedItemKeys. 
         // Let's just pass empty keys.
      }
      
      const targetUser = users?.find((u: any) => u.id === recipientUserId);
      if (!targetUser) throw new Error('User not found');
      
      const publicKeyBuf = Uint8Array.from(atob(targetUser.publicKey), c => c.charCodeAt(0)).buffer;
      const cryptoPubKey = await importPublicKey(publicKeyBuf);
      
      const newEncryptedItemKeys: Record<string, string> = {};
      const folderSecrets = secrets?.filter((s: any) => s.folders?.some((f: any) => f.folderId === shareFolderModal.folderId)) || [];
      
      for (const secret of folderSecrets) {
        let keyToUse = secret.encryptedItemKey;
        // Decrypt the itemKey
        const encryptedItemKeyBuf = Uint8Array.from(atob(keyToUse), c => c.charCodeAt(0)).buffer;
        const itemKey = await decryptItemKeyWithPrivateKey(encryptedItemKeyBuf, privateKey!);
        // Re-encrypt it
        const newEncryptedItemKey = await encryptItemKeyWithPublicKey(itemKey, cryptoPubKey);
        newEncryptedItemKeys[secret.id] = btoa(String.fromCharCode(...new Uint8Array(newEncryptedItemKey)));
      }

      const res = await apiFetch(`http://localhost:3000/folders/${shareFolderModal.folderId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          recipientUserId,
          permission,
          encryptedItemKeys: newEncryptedItemKeys
        })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to share folder');
      }
      
      toast.success('Folder shared successfully!');
      setShareFolderModal({ isOpen: false, folderId: '', folderName: '' });
      refetchFolders();
    } catch (e: any) {
      toast.error(`Error sharing folder: ${e.message}`);
    }
  };

  const handleRevokeFolderShare = (folderId: string, recipientId: string) => {
    setRevokeModal({ isOpen: true, folderId, recipientId });
  };

  const confirmRevokeFolderShare = async () => {
    if (!revokeModal.folderId || !revokeModal.recipientId) return;
    try {
      const res = await apiFetch(`http://localhost:3000/folders/${revokeModal.folderId}/share/${revokeModal.recipientId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to revoke share');
      toast.success('Access revoked successfully.');
      refetchFolders();
    } catch (e: any) {
      toast.error(`Error revoking folder access: ${e.message}`);
    } finally {
      setRevokeModal({ isOpen: false, folderId: '', recipientId: '' });
    }
  };

  const handleExport = async () => {
    if (!secrets || !privateKey) return;
    
    try {
      // Use the gated export endpoint to enforce fine-grained controls
      const res = await apiFetch('http://localhost:3000/secrets/export', { credentials: 'include' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Export restricted or failed');
      }
      const dataToExport = await res.json();

      // Client-side decryption for export
      const decryptedData = await Promise.all(dataToExport.map(async (secret: any) => {
        try {
          let keyToUse = secret.encryptedItemKey;
          if (user && secret.ownerId !== user.id) {
            const myShare = secret.shares?.find((s: any) => s.recipientUserId === user.id);
            if (myShare) keyToUse = myShare.encryptedItemKey;
          }
          const encryptedItemKeyBuf = Uint8Array.from(atob(keyToUse), c => c.charCodeAt(0)).buffer;
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
    } catch (e: any) {
      toast.error(`Export Failed: ${e.message}`);
    }
  };

  // Decrypt all secrets
  React.useEffect(() => {
    async function decryptAll() {
      if (!secrets || !privateKey) return;
      const decrypted: Record<string, any> = {};
      for (const secret of secrets) {
        try {
          let keyToUse = secret.encryptedItemKey;
          // Access Control fallback
          const sortedRequests = [...(secret.accessRequests || [])].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          const myRequest = sortedRequests.find((r: any) => r.status === 'APPROVED');
          if (myRequest && myRequest.encryptedItemKey) {
            keyToUse = myRequest.encryptedItemKey;
          } else {
            if (user && secret.ownerId !== user.id) {
              const myShare = secret.shares?.find((s: any) => s.recipientUserId === user.id);
              if (myShare) keyToUse = myShare.encryptedItemKey;
            }
          }
          const encryptedItemKeyBuf = Uint8Array.from(atob(keyToUse), c => c.charCodeAt(0)).buffer;
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
        <h2 className="text-xl font-bold text-yellow-800">VowGuard Locked</h2>
        <p className="mt-2 text-yellow-700">Please unlock your vault to view secrets.</p>
        {/* Sprint 3 temporary fix: Reload to prompt login if missing key */}
        <button onClick={() => window.location.href = '/login'} className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded">
          Unlock VowGuard
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
          await apiFetch(`http://localhost:3000/folders/${selectedFolderId}/secrets/${id}`, {
            method: 'DELETE',
            credentials: 'include'
          });
        } else {
          // Hard delete globally
          await apiFetch(`http://localhost:3000/secrets/${id}`, {
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
    <div className="w-full">
      <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Secrets</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
          <Button variant="outline" onClick={() => navigate('/import')}>
            Import CSV
          </Button>
          <Button onClick={() => navigate(`/secrets/new${selectedFolderId ? `?folderId=${selectedFolderId}` : ''}`)}>
            <Plus className="w-4 h-4 mr-2" /> Add Secret
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        <div className="w-full md:w-64 flex-shrink-0">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold tracking-tight">Folders</h2>
            <Button variant="ghost" size="icon" onClick={handleCreateFolder}>
              <Plus className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </Button>
          </div>
          <ul className="space-y-1">
            <li>
              <button onClick={() => setSelectedFolderId(null)} className={`flex w-full items-center gap-2 font-medium px-3 py-2 rounded-md text-sm transition-colors ${!selectedFolderId ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`}>
                <Folder className="w-4 h-4" /> All Secrets
              </button>
            </li>
            {folders?.map((folder: any) => {
              const isOwner = folder.ownerId === user?.id;
              return (
              <li key={folder.id} className="group flex items-center justify-between">
                <button onClick={() => setSelectedFolderId(folder.id)} className={`flex flex-1 items-center gap-2 px-3 py-2 rounded-md text-sm text-left truncate transition-colors ${selectedFolderId === folder.id ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`}>
                  <Folder className="w-4 h-4 flex-shrink-0" /> <span className="truncate">{folder.name}</span>
                  {!isOwner && <span className="ml-2 px-2 py-0.5 text-[10px] uppercase font-semibold bg-primary/20 text-primary rounded-full">Shared</span>}
                </button>
                {isOwner && (
                  <div className="hidden group-hover:flex items-center gap-1 pr-2">
                    <button onClick={() => setShareFolderModal({ isOpen: true, folderId: folder.id, folderName: folder.name })} className="p-1 text-muted-foreground hover:text-status-success transition-colors" title="Manage Access"><Share2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleRenameFolder(folder.id, folder.name)} className="p-1 text-muted-foreground hover:text-primary transition-colors" title="Rename Folder"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDeleteFolder(folder.id)} className="p-1 text-muted-foreground hover:text-status-danger transition-colors" title="Delete Folder"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </li>
              );
            })}
          </ul>
        </div>
        
        <div className="flex-grow min-w-0">
          {selectedSecretIds.length > 0 && (
            <div className="mb-4 flex items-center justify-between bg-primary/10 p-3 rounded-lg border border-primary/20">
              <span className="text-sm font-medium text-primary">{selectedSecretIds.length} selected</span>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-primary">Move to:</span>
                <Select onValueChange={(val: any) => { if(val) handleBulkMove(val); }}>
                  <SelectTrigger className="w-[180px] bg-background">
                    <SelectValue placeholder="Select folder..." />
                  </SelectTrigger>
                  <SelectContent>
                    {folders?.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground p-4">Loading...</div>
      ) : (
        <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-12 text-center pl-4">
                  <Checkbox 
                    checked={filteredSecrets.length > 0 && selectedSecretIds.length === filteredSecrets.length}
                    onCheckedChange={(c) => setSelectedSecretIds(c ? filteredSecrets.map((s:any) => s.id) : [])}
                  />
                </TableHead>
                <TableHead className="font-semibold text-muted-foreground">Name</TableHead>
                <TableHead className="font-semibold text-muted-foreground">Username</TableHead>
                <TableHead className="text-right font-semibold text-muted-foreground pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSecrets.map((secret: any) => (
                <TableRow key={secret.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="pl-4">
                    <Checkbox 
                      checked={selectedSecretIds.includes(secret.id)}
                      onCheckedChange={(c) => {
                        if (c) setSelectedSecretIds([...selectedSecretIds, secret.id]);
                        else setSelectedSecretIds(selectedSecretIds.filter(id => id !== secret.id));
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-muted rounded-md text-muted-foreground border border-border/50">
                        {getIconForTemplate(secret.templateType)}
                      </div>
                      <div className="ml-4 overflow-hidden">
                        <div className="text-sm font-medium text-foreground truncate">{secret.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{secret.domain}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-foreground truncate max-w-[150px]">
                      {decryptedSecrets[secret.id]?.username || '-'}
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-4">
                    <div className="flex items-center justify-end gap-3">
                    {secret.shares?.some((s: any) => s.recipientUserId === user?.id && s.permission === 'ONE_CLICK_LOGIN_ONLY') ? (
                      <span className="text-xs text-muted-foreground italic bg-muted px-2 py-1 rounded-md" title="Use the VowGuard extension to autofill these credentials">One-Click Only</span>
                    ) : (
                      <Link to={`/secrets/${secret.id}`} className="text-sm font-medium text-primary hover:text-blue-700 transition-colors">View</Link>
                    )}
                    {(secret.ownerId === user?.id || secret.shares?.some((s: any) => s.recipientUserId === user?.id && s.permission === 'MODIFY')) && (
                      <button onClick={() => handleDelete(secret.id)} className="text-sm font-medium text-status-danger hover:text-red-700 transition-colors">
                        {selectedFolderId ? 'Remove' : 'Delete'}
                      </button>
                    )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredSecrets.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="bg-muted p-4 rounded-full border border-border/50">
                        <Key className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <div className="text-foreground font-semibold text-lg tracking-tight">No secrets found</div>
                      <p className="text-muted-foreground max-w-sm text-sm mx-auto">
                        {selectedFolderId ? "This folder is empty. You can add new secrets here or move existing ones." : "Your vault is empty. Add a new secret to get started securely storing your passwords."}
                      </p>
                      <Button onClick={() => navigate(`/secrets/new${selectedFolderId ? `?folderId=${selectedFolderId}` : ''}`)} className="mt-2">
                        <Plus className="w-4 h-4 mr-2" /> Add Secret
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
        </div></div>
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
      <Modal 
        isOpen={shareFolderModal.isOpen} 
        onClose={() => setShareFolderModal({ isOpen: false, folderId: '', folderName: '' })}
        title={`Manage Folder Access: ${shareFolderModal.folderName}`}
        mode="custom"
      >
        <div className="space-y-6">
          {(() => {
            const activeFolder = folders?.find((f: any) => f.id === shareFolderModal.folderId);
            const sharedUsersMap = new Map<string, string>(); // userId -> permission
            activeFolder?.secrets?.forEach((fs: any) => {
              fs.secret?.shares?.forEach((share: any) => sharedUsersMap.set(share.recipientUserId, share.permission));
            });
            const sharedUsersList = Array.from(sharedUsersMap.entries()).map(([id, perm]) => ({
              user: users?.find((u: any) => u.id === id),
              permission: perm
            })).filter(x => x.user);

            return sharedUsersList.length > 0 ? (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Currently Shared With</h4>
                <ul className="divide-y divide-gray-200 dark:divide-gray-700 border rounded-lg">
                  {sharedUsersList.map((su: any) => (
                    <li key={su.user.id} className="px-3 py-2 flex justify-between items-center text-sm text-gray-700 dark:text-gray-300">
                      <span>{su.user.email} <span className="text-xs text-gray-500 ml-2">({su.permission})</span></span>
                      <div className="flex items-center gap-2">
                        <select 
                          className="text-xs border border-gray-300 rounded p-1 dark:bg-gray-800 dark:border-gray-600"
                          value={su.permission}
                          onChange={(e) => submitFolderShare(su.user.id, e.target.value)}
                        >
                          <option value="VIEW">Read Only</option>
                          <option value="MODIFY">Read & Write</option>
                        </select>
                        <button onClick={() => handleRevokeFolderShare(shareFolderModal.folderId, su.user.id)} className="text-red-600 hover:text-red-800 font-medium ml-2">Revoke</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null;
          })()}
          
          {(() => {
            const activeFolder = folders?.find((f: any) => f.id === shareFolderModal.folderId);
            const sharedUserIds = new Set<string>();
            activeFolder?.secrets?.forEach((fs: any) => {
              fs.secret?.shares?.forEach((share: any) => sharedUserIds.add(share.recipientUserId));
            });
            
            return (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Share with New User</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select User</label>
                <select 
                  id="shareUserSelect"
                  className="w-full border-gray-300 dark:border-gray-700 rounded-md shadow-sm dark:bg-gray-800 dark:text-white p-2 border"
                  defaultValue=""
                >
                  <option value="" disabled>Select a user...</option>
                  {users?.filter((u: any) => u.id !== user?.id && !sharedUserIds.has(u.id)).map((u: any) => (
                    <option key={u.id} value={u.id}>{u.email}</option>
                  ))}
                </select>
              </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Permission</label>
            <select 
              id="sharePermissionSelect"
              className="w-full border-gray-300 dark:border-gray-700 rounded-md shadow-sm dark:bg-gray-800 dark:text-white p-2 border"
              defaultValue="VIEW"
            >
              <option value="VIEW">Read Only</option>
              <option value="MODIFY">Read & Write</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button 
              onClick={() => setShareFolderModal({ isOpen: false, folderId: '', folderName: '' })}
              className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
            >
              Cancel
            </button>
            <button 
              onClick={() => {
                const userSelect = document.getElementById('shareUserSelect') as HTMLSelectElement;
                const permSelect = document.getElementById('sharePermissionSelect') as HTMLSelectElement;
                if (!userSelect.value) return toast.error('Please select a user');
                submitFolderShare(userSelect.value, permSelect.value);
              }}
              className="px-4 py-2 bg-primary text-white hover:bg-blue-700 rounded-lg"
            >
              Share Folder
            </button>
          </div>
            </div>
          </div>
          );
          })()}
        </div>
      </Modal>

      <Modal
        isOpen={revokeModal.isOpen}
        onClose={() => setRevokeModal({ isOpen: false, folderId: '', recipientId: '' })}
        title="Revoke Folder Access"
        message="Are you sure you want to revoke access for this user?"
        confirmText="Revoke"
        confirmColor="red"
        onConfirm={confirmRevokeFolderShare}
      />

      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
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
