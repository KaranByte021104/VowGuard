import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Shield, Plus, Key, Server, Globe, Box, MoreVertical, Trash } from 'lucide-react';
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

  const { data: secrets, isLoading, refetch } = useQuery({
    queryKey: ['secrets'],
    queryFn: async () => {
      const res = await fetch('http://localhost:3000/secrets', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch secrets');
      return res.json();
    }
  });

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

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this secret?')) return;
    await fetch(`http://localhost:3000/secrets/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    refetch();
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Secrets Vault</h1>
        <div className="flex gap-4">
          <Link to="/import" className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
            Import CSV
          </Link>
          <Link to="/secrets/new" className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Add Secret
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {secrets?.map((secret: any) => (
                <tr key={secret.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
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
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {secrets?.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-gray-500">
                    No secrets in this vault yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
