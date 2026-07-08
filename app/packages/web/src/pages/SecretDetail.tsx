import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSessionStore } from '../store/session';
import { decryptSecretPayload, decryptItemKeyWithPrivateKey, encryptSecretPayload } from '@app/shared/src/crypto';
import { Eye, EyeOff, Save, Trash, ArrowLeft } from 'lucide-react';
import { PasswordGenerator } from '../components/PasswordGenerator';
import zxcvbn from 'zxcvbn';

export function SecretDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { privateKey, publicKey } = useSessionStore();
  
  const [formData, setFormData] = useState({
    name: '',
    domain: '',
    username: '',
    password: '',
    notes: ''
  });
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [decryptionError, setDecryptionError] = useState('');

  const { data: secret, isLoading } = useQuery({
    queryKey: ['secret', id],
    queryFn: async () => {
      const res = await fetch(`http://localhost:3000/secrets/${id}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Secret not found');
      return res.json();
    }
  });

  useEffect(() => {
    async function decrypt() {
      if (!secret || !privateKey) return;
      try {
        const encryptedItemKeyBuf = Uint8Array.from(atob(secret.encryptedItemKey), c => c.charCodeAt(0)).buffer;
        const itemKey = await decryptItemKeyWithPrivateKey(encryptedItemKeyBuf, privateKey);
        
        const encryptedDataBuf = Uint8Array.from(atob(secret.encryptedData), c => c.charCodeAt(0)).buffer;
        const ivBuf = Uint8Array.from(atob(secret.iv), c => c.charCodeAt(0));
        
        const payload = await decryptSecretPayload(encryptedDataBuf, ivBuf, itemKey);
        
        setFormData({
          name: secret.name,
          domain: secret.domain || '',
          username: payload.username || '',
          password: payload.password || '',
          notes: payload.notes || ''
        });
      } catch (e) {
        setDecryptionError('Failed to decrypt secret.');
        console.error(e);
      }
    }
    decrypt();
  }, [secret, privateKey]);

  const passwordScore = formData.password ? zxcvbn(formData.password).score : 0;

  const arrayBufferToBase64 = (buffer: ArrayBufferLike) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  const handleUpdate = async () => {
    if (!publicKey || !secret) return;
    setLoading(true);
    try {
      // Re-encrypt the payload. We could theoretically reuse the itemKey, but creating a new one is safer.
      const encryptedItemKeyBuf = Uint8Array.from(atob(secret.encryptedItemKey), c => c.charCodeAt(0)).buffer;
      const itemKey = await decryptItemKeyWithPrivateKey(encryptedItemKeyBuf, privateKey!);

      const payload = {
        username: formData.username,
        password: formData.password,
        notes: formData.notes
      };
      
      const { encryptedData, iv } = await encryptSecretPayload(payload, itemKey);

      const res = await fetch(`http://localhost:3000/secrets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: formData.name,
          domain: formData.domain,
          encryptedData: arrayBufferToBase64(encryptedData),
          iv: arrayBufferToBase64(iv.buffer),
          encryptedItemKey: secret.encryptedItemKey // Key hasn't changed
        })
      });

      if (!res.ok) throw new Error('Update failed');
      setIsEditing(false);
    } catch (e) {
      console.error(e);
      alert('Error updating secret');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you absolutely sure you want to delete this secret? This cannot be undone.')) return;
    await fetch(`http://localhost:3000/secrets/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    navigate('/secrets');
  };

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!privateKey) return <div className="p-8">Vault locked.</div>;
  if (decryptionError) return <div className="p-8 text-red-500">{decryptionError}</div>;

  return (
    <div className="max-w-3xl mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <button onClick={() => navigate('/secrets')} className="flex items-center text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
          <ArrowLeft className="w-5 h-5 mr-2" /> Back
        </button>
        <div className="flex gap-4">
          {!isEditing ? (
            <>
              <button onClick={() => setIsEditing(true)} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50">Edit</button>
              <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2"><Trash className="w-4 h-4"/> Delete</button>
            </>
          ) : (
            <>
              <button onClick={() => setIsEditing(false)} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50">Cancel</button>
              <button onClick={handleUpdate} disabled={loading} className="px-4 py-2 bg-primary text-white rounded-md hover:bg-blue-700 flex items-center gap-2"><Save className="w-4 h-4"/> Save</button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-6 bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
            <input 
              value={formData.name} 
              onChange={(e) => setFormData({...formData, name: e.target.value})} 
              disabled={!isEditing}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 bg-gray-50 dark:bg-gray-700 dark:text-white disabled:opacity-75 disabled:bg-gray-100 dark:disabled:bg-gray-800" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Domain / URL</label>
            <input 
              value={formData.domain} 
              onChange={(e) => setFormData({...formData, domain: e.target.value})} 
              disabled={!isEditing}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 bg-gray-50 dark:bg-gray-700 dark:text-white disabled:opacity-75 disabled:bg-gray-100 dark:disabled:bg-gray-800" 
            />
          </div>
        </div>

        <hr className="border-gray-200 dark:border-gray-700" />

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Username</label>
            <input 
              value={formData.username} 
              onChange={(e) => setFormData({...formData, username: e.target.value})} 
              disabled={!isEditing}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 bg-gray-50 dark:bg-gray-700 dark:text-white disabled:opacity-75 disabled:bg-gray-100 dark:disabled:bg-gray-800" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 flex justify-between">
              <span>Password</span>
              {isEditing && <button type="button" onClick={() => setShowGenerator(!showGenerator)} className="text-primary hover:text-blue-700">Generator</button>}
            </label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                value={formData.password} 
                onChange={(e) => setFormData({...formData, password: e.target.value})} 
                disabled={!isEditing}
                className={`mt-1 block w-full rounded-md shadow-sm p-2 pr-10 bg-gray-50 dark:bg-gray-700 dark:text-white disabled:opacity-75 disabled:bg-gray-100 dark:disabled:bg-gray-800 ${isEditing && formData.password ? (passwordScore < 3 ? 'border-red-300' : 'border-green-300') : 'border-gray-300 dark:border-gray-600'}`} 
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute bottom-2 right-3 text-gray-400 hover:text-gray-600">
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {isEditing && formData.password && (
              <div className="flex gap-1 mt-2 h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className={`h-full flex-1 ${
                    i < passwordScore 
                      ? (passwordScore < 3 ? 'bg-red-500' : passwordScore === 3 ? 'bg-yellow-500' : 'bg-green-500') 
                      : 'bg-transparent'
                  }`} />
                ))}
              </div>
            )}
          </div>
        </div>

        {showGenerator && isEditing && (
          <PasswordGenerator onSelect={(pwd) => setFormData({ ...formData, password: pwd })} />
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Secure Notes</label>
          <textarea 
            rows={4} 
            value={formData.notes} 
            onChange={(e) => setFormData({...formData, notes: e.target.value})} 
            disabled={!isEditing}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 bg-gray-50 dark:bg-gray-700 dark:text-white disabled:opacity-75 disabled:bg-gray-100 dark:disabled:bg-gray-800" 
          />
        </div>

      </div>
    </div>
  );
}
