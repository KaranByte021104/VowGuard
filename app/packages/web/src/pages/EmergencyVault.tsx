import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Box, Globe, Server, Key } from 'lucide-react';
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

export function EmergencyVault() {
  const { ownerId } = useParams<{ ownerId: string }>();
  const { privateKey } = useSessionStore();
  const [secrets, setSecrets] = useState<any[]>([]);
  const [decryptedSecrets, setDecryptedSecrets] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadEmergencyVault() {
      if (!privateKey) {
        setError('Your encryption keys are missing from memory (this happens if you refresh the page). Please log out and log back in to unlock your keys.');
        return;
      }
      try {
        // 1. Fetch the owner's secrets
        const res = await fetch(`http://localhost:3000/emergency-access/vault/${ownerId}`, { credentials: 'include' });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.message || 'Failed to fetch vault');
        }
        const vaultSecrets = await res.json();
        setSecrets(vaultSecrets);

        // 2. Fetch the emergency grant to get the encrypted private key
        const grantsRes = await fetch('http://localhost:3000/emergency-access/grants', { credentials: 'include' });
        const grants = await grantsRes.json();
        const activeGrant = grants.find((g: any) => g.ownerId === ownerId && g.status === 'ACTIVE');
        
        if (!activeGrant) {
          throw new Error('No active emergency grant found');
        }

        // 3. Decrypt the AES emergency key using our RSA private key, then decrypt the owner's private key
        const parts = activeGrant.encryptedPrivateKey.split(':');
        if (parts.length !== 3) throw new Error('Invalid encrypted private key format');
        
        const ivBuf = Uint8Array.from(atob(parts[0]), c => c.charCodeAt(0)).buffer;
        const encryptedEmergencyKeyBuf = Uint8Array.from(atob(parts[1]), c => c.charCodeAt(0)).buffer;
        const encryptedPrivKeyBuf = Uint8Array.from(atob(parts[2]), c => c.charCodeAt(0)).buffer;
        
        const emergencyKeyRaw = await window.crypto.subtle.decrypt(
          { name: 'RSA-OAEP' },
          privateKey, // Our private key decrypts the AES key
          encryptedEmergencyKeyBuf
        );

        const emergencyKey = await window.crypto.subtle.importKey(
          'raw',
          emergencyKeyRaw,
          { name: 'AES-GCM' },
          false,
          ['decrypt']
        );

        const decryptedPkcs8 = await window.crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: ivBuf },
          emergencyKey,
          encryptedPrivKeyBuf
        );

        const ownerPrivateKey = await window.crypto.subtle.importKey(
          'pkcs8',
          decryptedPkcs8,
          { name: 'RSA-OAEP', hash: 'SHA-256' },
          false,
          ['decrypt']
        );

        // 4. Decrypt the secrets using the owner's private key
        const decrypted: Record<string, any> = {};
        for (const secret of vaultSecrets) {
          try {
            const encryptedItemKeyBuf = Uint8Array.from(atob(secret.encryptedItemKey), c => c.charCodeAt(0)).buffer;
            const itemKey = await decryptItemKeyWithPrivateKey(encryptedItemKeyBuf, ownerPrivateKey);
            
            const encryptedDataBuf = Uint8Array.from(atob(secret.encryptedData), c => c.charCodeAt(0)).buffer;
            const ivBuf = Uint8Array.from(atob(secret.iv), c => c.charCodeAt(0));
            
            const payload = await decryptSecretPayload(encryptedDataBuf, ivBuf, itemKey);
            decrypted[secret.id] = payload;
          } catch (e) {
            console.error('Failed to decrypt secret', secret.id, e);
            decrypted[secret.id] = { error: 'Failed' };
          }
        }
        setDecryptedSecrets(decrypted);

      } catch (e: any) {
        console.error(e);
        setError(e.message);
      }
    }
    loadEmergencyVault();
  }, [ownerId, privateKey]);

  if (error) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Link to="/emergency" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="bg-red-50 text-red-800 p-6 rounded-lg border border-red-200">
          <h2 className="text-xl font-bold mb-2">Access Denied</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <Link to="/emergency" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Emergency Access
      </Link>
      
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <span className="bg-red-100 text-red-600 px-3 py-1 rounded-lg text-sm font-bold uppercase tracking-wide">Emergency Mode</span>
          Vault Access
        </h1>
        <p className="text-gray-500 mt-2">You are viewing this vault under an active emergency grant. Read-only access.</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Password</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {secrets.map((secret: any) => {
              const decrypted = decryptedSecrets[secret.id];
              return (
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
                    <div className="text-sm text-gray-900 dark:text-gray-300 font-mono">
                      {decrypted?.username || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-gray-300 font-mono">
                      {decrypted?.password || '-'}
                    </div>
                  </td>
                </tr>
              );
            })}
            {secrets.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-12 text-center text-gray-500">
                  No secrets found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
