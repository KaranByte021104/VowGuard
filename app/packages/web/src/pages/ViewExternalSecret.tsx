import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Shield, Eye, EyeOff, Unlock } from 'lucide-react';
import { deriveKey, decryptPrivateKey, decryptItemKeyWithPrivateKey, decryptSecretPayload } from '@app/shared/src/crypto';
import { apiFetch } from '../lib/apiFetch';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

export function ViewExternalSecret() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [invite, setInvite] = useState<any>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [decryptedFields, setDecryptedFields] = useState<any[]>([]);

  useEffect(() => {
    if (token) {
      fetchInvite();
    }
  }, [token]);

  const fetchInvite = async () => {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(token!);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const res = await apiFetch(`http://localhost:3000/shares/external/${tokenHash}`);
      if (!res.ok) {
        let errorMsg = 'Failed to fetch invite';
        try {
          const errData = await res.json();
          errorMsg = errData.message || errorMsg;
        } catch {
          errorMsg = await res.text();
        }
        throw new Error(errorMsg);
      }
      const dataJson = await res.json();
      setInvite(dataJson);
      if (dataJson.status === 'PENDING') {
        setError('This invite has not been accepted yet. Please accept it first.');
      } else if (dataJson.status === 'ACCEPTED' && !dataJson.encryptedItemKey) {
        setError('The owner has not finalized this invite yet. Please wait for them to finalize it.');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to fetch invite');
    }
  };

  const handleDecrypt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite || !invite.secret || !invite.encryptedItemKey) {
      setError('Secret is not ready for viewing yet.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Re-derive the key from the password
      const encoder = new TextEncoder();
      const data = encoder.encode(token!);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const derivedKey = await deriveKey(password, tokenHash);

      // 2. Decrypt the private key
      const [ivBase64, encryptedBase64] = invite.encryptedPrivateKey.split(':');
      const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
      const encryptedPrivateKeyBuf = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0)).buffer;
      const privateKey = await decryptPrivateKey(encryptedPrivateKeyBuf, iv, derivedKey);

      // 3. Decrypt the item key
      const encryptedItemKeyBuf = Uint8Array.from(atob(invite.encryptedItemKey), c => c.charCodeAt(0)).buffer;
      const itemKey = await decryptItemKeyWithPrivateKey(encryptedItemKeyBuf, privateKey);

      // 4. Decrypt the secret data
      const encryptedDataBuf = Uint8Array.from(atob(invite.secret.encryptedData), c => c.charCodeAt(0)).buffer;
      const ivBuf = Uint8Array.from(atob(invite.secret.iv), c => c.charCodeAt(0));

      const payload = await decryptSecretPayload(encryptedDataBuf, ivBuf, itemKey);

      const parsedFields = Object.entries(payload).map(([key, value]) => {
        let type = 'text';
        if (key.toLowerCase().includes('password')) type = 'password';
        if (key.toLowerCase().includes('url')) type = 'url';
        return { label: key, value, type };
      });

      setDecryptedFields(parsedFields);
      setPassword(''); // Clear password from memory
    } catch (err: any) {
      console.error(err);
      setError('Failed to decrypt. Incorrect master password?');
    } finally {
      setLoading(false);
    }
  };

  if (decryptedFields.length > 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-2xl text-center mb-8">
          <Shield className="mx-auto h-12 w-12 text-primary" />
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Secure Vault</h2>
          <p className="mt-2 text-sm text-gray-600">
            Decrypted securely in your browser.
          </p>
        </div>

        <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
          <div className="bg-white py-8 px-8 shadow sm:rounded-lg border border-gray-200">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b">
              <Unlock className="w-8 h-8 text-green-500" />
              <div>
                <h3 className="text-xl font-bold">{invite?.secret?.name}</h3>
                <p className="text-sm text-gray-500">Shared with {invite?.email}</p>
              </div>
            </div>

            <div className="space-y-4">
              {decryptedFields.map((field, idx) => (
                <div key={idx} className="bg-gray-50 p-4 rounded-md border border-gray-100">
                  <Label className="text-xs uppercase text-gray-500 tracking-wider mb-1 block">
                    {field.label}
                  </Label>
                  {field.type === 'password' ? (
                    <div className="font-mono bg-white p-2 border rounded mt-1 select-all break-all text-sm">
                      {field.value}
                    </div>
                  ) : (
                    <div className="font-medium mt-1 select-all break-all">
                      {field.value}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Shield className="mx-auto h-12 w-12 text-primary" />
        <h2 className="mt-6 text-3xl font-extrabold text-gray-900">View Secret</h2>
        {invite && invite.status === 'ACCEPTED' && invite.encryptedItemKey ? (
          <p className="mt-2 text-sm text-gray-600">
            Enter your master password to decrypt the secret.
          </p>
        ) : (
          <p className="mt-2 text-sm text-gray-600">
            Checking status...
          </p>
        )}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-200">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {invite && invite.status === 'ACCEPTED' && invite.encryptedItemKey && (
            <form className="space-y-6" onSubmit={handleDecrypt}>
              <div>
                <Label htmlFor="password">Master Password</Label>
                <div className="mt-1 relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-500"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading || !password}>
                {loading ? 'Decrypting...' : 'Decrypt'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
