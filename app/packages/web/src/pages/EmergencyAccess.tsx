import React, { useState, useEffect } from 'react';
import { ShieldAlert, Trash2, Plus, Clock, User, AlertTriangle } from 'lucide-react';
import { useSessionStore } from '../store/session';
import { Modal } from '../components/Modal';
import { useNavigate } from 'react-router-dom';

export function EmergencyAccess() {
  const { user, privateKey } = useSessionStore();
  const navigate = useNavigate();
  const [designatedContacts, setDesignatedContacts] = useState<any[]>([]);
  const [receivedGrants, setReceivedGrants] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [waitingHours, setWaitingHours] = useState(24);
  const [validityHours, setValidityHours] = useState(48);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchContacts();
    fetchReceivedGrants();
    fetchUsers();

    // Setup polling for status updates (e.g., from PENDING to ACTIVE via BullMQ worker)
    const interval = setInterval(() => {
      fetchReceivedGrants();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const fetchContacts = () => {
    fetch('http://localhost:3000/emergency-access/contacts', { credentials: 'include' })
      .then(res => res.json())
      .then(setDesignatedContacts)
      .catch(console.error);
  };

  const fetchReceivedGrants = () => {
    fetch('http://localhost:3000/emergency-access/grants', { credentials: 'include' })
      .then(res => res.json())
      .then(setReceivedGrants)
      .catch(console.error);
  };

  const fetchUsers = () => {
    fetch('http://localhost:3000/users', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setUsers(data.filter((u: any) => u.id !== user?.id)))
      .catch(console.error);
  };

  const handleAddContact = async () => {
    if (!selectedUserId || !privateKey) return;
    setIsLoading(true);
    try {
      // 1. Get the contact's public key
      const contactUser = users.find(u => u.id === selectedUserId);
      if (!contactUser || !contactUser.publicKey) throw new Error('Contact has no public key');

      // 2. Export owner's private key (this is normally securely stored and decrypted, but since we only have CryptoKey in memory, we export it)
      const pkcs8 = await window.crypto.subtle.exportKey('pkcs8', privateKey);
      const privateKeyBytes = new Uint8Array(pkcs8);

      // 3. Import contact's public key
      const spkiBuf = Uint8Array.from(atob(contactUser.publicKey), c => c.charCodeAt(0)).buffer;
      const importedContactPubKey = await window.crypto.subtle.importKey(
        'spki',
        spkiBuf,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        false,
        ['encrypt']
      );

      // 4. Generate random AES-GCM key
      const emergencyKey = await window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      
      const emergencyKeyRaw = await window.crypto.subtle.exportKey('raw', emergencyKey);

      // 5. Encrypt AES key with contact's public RSA key
      const encryptedEmergencyKey = await window.crypto.subtle.encrypt(
        { name: 'RSA-OAEP' },
        importedContactPubKey,
        emergencyKeyRaw
      );

      // 6. Encrypt the owner's private key with the AES key
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encryptedPkcs8 = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        emergencyKey,
        privateKeyBytes
      );
      
      const ivBlob = btoa(String.fromCharCode(...iv));
      const encKeyBlob = btoa(String.fromCharCode(...new Uint8Array(encryptedEmergencyKey)));
      const encDataBlob = btoa(String.fromCharCode(...new Uint8Array(encryptedPkcs8)));

      const encryptedBlob = `${ivBlob}:${encKeyBlob}:${encDataBlob}`;

      // 7. Send to backend
      const res = await fetch('http://localhost:3000/emergency-access/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: selectedUserId,
          sessionValidityHours: validityHours,
          waitingPeriodHours: waitingHours,
          encryptedPrivateKey: encryptedBlob
        }),
        credentials: 'include'
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || 'Server returned error');
      }

      setIsAddModalOpen(false);
      fetchContacts();
    } catch (e) {
      console.error(e);
      alert('Failed to add contact');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveContact = async (grantId: string) => {
    await fetch(`http://localhost:3000/emergency-access/contacts/${grantId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    fetchContacts();
  };

  const handleTriggerGrant = async (grantId: string) => {
    try {
      const res = await fetch(`http://localhost:3000/emergency-access/grants/${grantId}/trigger`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to trigger');
      }
      fetchReceivedGrants();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDenyGrant = async (grantId: string) => {
    try {
      await fetch(`http://localhost:3000/emergency-access/grants/${grantId}/deny`, {
        method: 'POST',
        credentials: 'include'
      });
      fetchContacts();
    } catch (e) {
      console.error(e);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800';
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'DENIED': return 'bg-red-100 text-red-800';
      case 'EXPIRED': return 'bg-gray-100 text-gray-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Emergency Access</h1>
          <p className="text-gray-500 mt-1">Designate trusted contacts to access your vault if you become unavailable.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: My Designated Contacts (Given Grants) */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">My Emergency Contacts</h2>
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" /> Add Contact
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
            {designatedContacts.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center">
                <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-full mb-4">
                  <ShieldAlert className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-gray-900 dark:text-white font-medium text-lg mb-2">No emergency contacts set up</h3>
                <p className="text-gray-500 max-w-sm text-sm mb-4">
                  Ensure you don't lose access to your vault. Designate a trusted contact who can access your account if you become unavailable.
                </p>
                <button 
                  onClick={() => setIsAddModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  <Plus className="w-4 h-4" /> Add Emergency Contact
                </button>
              </div>
            ) : (
              designatedContacts.map(grant => (
                <div key={grant.id} className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                        {grant.contact.email[0].toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">{grant.contact.email}</h3>
                        <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> Wait: {grant.waitingPeriodHours}h</span>
                          <span className="flex items-center gap-1"><User className="w-3 h-3"/> Session: {grant.sessionValidityHours}h</span>
                        </div>
                      </div>
                    </div>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(grant.status)}`}>
                      {grant.status}
                    </span>
                  </div>

                  {grant.status === 'PENDING' && (
                    <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-yellow-800">Access Requested</h4>
                          <p className="text-sm text-yellow-700 mt-1">
                            This contact has requested emergency access. Unless you deny this request, access will be granted automatically.
                          </p>
                          <div className="mt-3 flex gap-3">
                            <button 
                              onClick={() => handleDenyGrant(grant.id)}
                              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded shadow hover:bg-red-700"
                            >
                              Deny Request
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex justify-end border-t border-gray-100 dark:border-gray-700 pt-4">
                    <button 
                      onClick={() => handleRemoveContact(grant.id)}
                      className="text-red-600 hover:text-red-900 text-sm font-medium flex items-center gap-1"
                    >
                      <Trash2 className="w-4 h-4" /> Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: People who trust me (Received Grants) */}
        <div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Emergency Access Trusted By</h2>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
            {receivedGrants.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center">
                <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-full mb-4">
                  <User className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-gray-900 dark:text-white font-medium text-lg mb-2">No emergency access granted to you</h3>
                <p className="text-gray-500 max-w-sm text-sm">
                  When someone adds you as their emergency contact, their access grants will appear here.
                </p>
              </div>
            ) : (
              receivedGrants.map(grant => (
                <div key={grant.id} className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center font-bold">
                        {grant.owner.email[0].toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">{grant.owner.email}</h3>
                      </div>
                    </div>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(grant.status)}`}>
                      {grant.status}
                    </span>
                  </div>

                  {grant.status === 'INACTIVE' && (
                    <button 
                      onClick={() => handleTriggerGrant(grant.id)}
                      className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-lg text-sm transition-colors"
                    >
                      Request Emergency Access
                    </button>
                  )}

                  {grant.status === 'PENDING' && (
                    <p className="text-sm text-yellow-600 bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                      Request pending. Waiting period is {grant.waitingPeriodHours} hours. Owner has been notified.
                    </p>
                  )}

                  {grant.status === 'ACTIVE' && (
                    <div className="flex flex-col gap-3">
                      <p className="text-sm text-green-700 bg-green-50 p-3 rounded-lg border border-green-200">
                        Access granted. Session valid for {grant.sessionValidityHours} hours.
                      </p>
                      <button
                        onClick={() => navigate(`/emergency/${grant.owner.id}`)}
                        className="w-full py-2 bg-primary hover:bg-blue-700 text-white font-medium rounded-lg text-sm shadow-sm transition-colors"
                      >
                        Enter Vault
                      </button>
                    </div>
                  )}

                  {grant.status === 'DENIED' && (
                    <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
                      The owner denied your request.
                    </p>
                  )}

                  {grant.status === 'EXPIRED' && (
                    <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-100">
                      Your emergency access session has expired.
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <Modal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        title="Designate Emergency Contact"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select User</label>
            <select 
              className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              <option value="">Choose a trusted contact...</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Wait Period (Hours)</label>
            <p className="text-xs text-gray-500 mb-2">How long before access is granted automatically after they trigger a request?</p>
            <input 
              type="number" 
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600"
              value={waitingHours}
              onChange={(e) => setWaitingHours(parseInt(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Session Validity (Hours)</label>
            <p className="text-xs text-gray-500 mb-2">How long will their access last once granted?</p>
            <input 
              type="number" 
              min="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600"
              value={validityHours}
              onChange={(e) => setValidityHours(parseInt(e.target.value))}
            />
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button 
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button 
              onClick={handleAddContact}
              disabled={!selectedUserId || isLoading}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? 'Encrypting...' : 'Designate Contact'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
