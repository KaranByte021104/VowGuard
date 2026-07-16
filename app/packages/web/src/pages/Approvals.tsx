import toast from 'react-hot-toast';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, CheckCircle, XCircle } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useSessionStore } from '../store/session';
import { Button } from '../components/ui/button';
import { decryptItemKeyWithPrivateKey, encryptItemKeyWithPublicKey, importPublicKey } from '@app/shared/src/crypto';
import { apiFetch } from '../lib/apiFetch';

export function Approvals() {
  const { privateKey } = useSessionStore();
  const [loading, setLoading] = useState(false);
  const [modalState, setModalState] = useState<{isOpen: boolean, req: any, action: 'approve'|'deny'|null}>({
    isOpen: false, req: null, action: null
  });

  const { data: requests, refetch, isLoading } = useQuery({
    queryKey: ['pendingRequests'],
    queryFn: async () => {
      const res = await apiFetch('http://localhost:3000/requests/pending', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load pending requests');
      return res.json();
    }
  });

  const handleAction = async () => {
    const { req, action } = modalState;
    if (!req || !action) return;
    setLoading(true);
    
    let finalKey = '';
    
    if (action === 'approve') {
      if (!privateKey || !req.secret.encryptedItemKey || !req.requester.publicKey) {
        toast.error('Missing cryptographic keys required to approve this request.');
        setLoading(false);
        return;
      }
      try {
        const encryptedItemKeyBuf = Uint8Array.from(atob(req.secret.encryptedItemKey), c => c.charCodeAt(0)).buffer;
        const itemKey = await decryptItemKeyWithPrivateKey(encryptedItemKeyBuf, privateKey);
        
        const publicKeyBuf = Uint8Array.from(atob(req.requester.publicKey), c => c.charCodeAt(0)).buffer;
        const cryptoPubKey = await importPublicKey(publicKeyBuf);
        const newEncryptedItemKey = await encryptItemKeyWithPublicKey(itemKey, cryptoPubKey);
        
        let binary = '';
        const bytes = new Uint8Array(newEncryptedItemKey);
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        finalKey = window.btoa(binary);
      } catch (e) {
        console.error('Failed to encrypt key for requester', e);
        toast.error('Cryptographic error: You cannot approve this request because you do not have the required key (you must be the Owner or have the secret shared with you).');
        setLoading(false);
        return;
      }
    }

    try {
      const res = await apiFetch(`http://localhost:3000/requests/${req.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          encryptedItemKey: finalKey
        })
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      toast.success(data.message);
      refetch();
    } catch (e: any) {
      toast.error(e.message || `Failed to ${action}`);
    } finally {
      setLoading(false);
      setModalState({ isOpen: false, req: null, action: null });
    }
  };

  if (isLoading) return <div className="p-8">Loading requests...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <ShieldAlert className="w-8 h-8 text-primary" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pending Approvals</h1>
      </div>

      {(!requests || requests.length === 0) ? (
        <div className="bg-white dark:bg-gray-800 p-8 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
          <p className="text-gray-500">You have no pending requests to approve.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req: any) => (
            <div key={req.id} className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 flex justify-between items-center shadow-sm">
              <div>
                <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
                  {req.secret.name}
                </h3>
                <p className="text-sm text-gray-500 mb-2">Requested by {req.requester.email}</p>
                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded border border-gray-200 dark:border-gray-600">
                  <span className="font-medium text-xs uppercase text-gray-400 block mb-1">Reason:</span>
                  <p className="text-sm text-gray-700 dark:text-gray-300">"{req.reason}"</p>
                </div>
              </div>
              
              <div className="flex flex-col gap-2 ml-6 min-w-[120px]">
                <Button 
                  onClick={() => setModalState({ isOpen: true, req, action: 'approve' })}
                  disabled={loading}
                  className="bg-status-success hover:bg-status-success/90 text-white"
                >
                  <CheckCircle className="w-4 h-4 mr-2" /> Approve
                </Button>
                <Button 
                  onClick={() => setModalState({ isOpen: true, req, action: 'deny' })}
                  disabled={loading}
                  variant="destructive"
                >
                  <XCircle className="w-4 h-4 mr-2" /> Deny
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal 
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ isOpen: false, req: null, action: null })}
        title={modalState.action === 'approve' ? 'Approve Request' : 'Deny Request'}
        message={`Are you sure you want to ${modalState.action} access to "${modalState.req?.secret?.name}" for ${modalState.req?.requester?.email}?`}
        confirmText={modalState.action === 'approve' ? 'Confirm Approval' : 'Confirm Denial'}
        confirmColor={modalState.action === 'approve' ? 'primary' : 'red'}
        onConfirm={handleAction}
      />
    </div>
  );
}
