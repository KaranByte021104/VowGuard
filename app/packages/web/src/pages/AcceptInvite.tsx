import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Shield, Eye, EyeOff } from 'lucide-react';
import { deriveKey, generateKeyPair, encryptPrivateKey, exportPublicKey } from '@app/shared/src/crypto';
import { apiFetch } from '../lib/apiFetch';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

export function AcceptInvite() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing invite token.');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 12) {
      setError('Master password must be at least 12 characters');
      return;
    }

    setLoading(true);

    try {
      // Hash the token to match what the backend expects
      const encoder = new TextEncoder();
      const data = encoder.encode(token!);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Generate keypair for the external user
      const keyPair = await generateKeyPair();
      
      // Derive a key from their chosen master password to encrypt their private key
      // We don't have a salt in this flow so we'll use the tokenHash as the salt
      const derivedKey = await deriveKey(password, tokenHash);
      
      const exportedPublicKey = await exportPublicKey(keyPair.publicKey);
      const { encrypted: encryptedPrivateKeyBuf, iv } = await encryptPrivateKey(keyPair.privateKey, derivedKey);
      
      // Convert ArrayBuffers to base64
      const ephemeralPublicKey = btoa(String.fromCharCode(...new Uint8Array(exportedPublicKey)));
      
      const ivBase64 = btoa(String.fromCharCode(...iv));
      const encryptedBase64 = btoa(String.fromCharCode(...new Uint8Array(encryptedPrivateKeyBuf)));
      const encryptedPrivateKey = `${ivBase64}:${encryptedBase64}`;

      const res = await apiFetch(`http://localhost:3000/shares/invite/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenHash,
          ephemeralPublicKey,
          encryptedPrivateKey,
        }),
      });

      if (!res.ok) {
        let errorMsg = 'Failed to accept invite';
        try {
          const errData = await res.json();
          errorMsg = errData.message || errorMsg;
        } catch {
          errorMsg = await res.text();
        }
        throw new Error(errorMsg);
      }

      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to accept invite');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <Shield className="mx-auto h-12 w-12 text-primary" />
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Invite Accepted!</h2>
          <p className="mt-2 text-sm text-gray-600">
            You have successfully accepted the secure share. The owner must now finalize the encryption before you can view the secret.
            Please save the URL that you just visited, or ask the owner to send you the link again once finalized.
          </p>
          <div className="mt-6">
            <Button onClick={() => navigate(`/external-secret?token=${token}`)}>
              View Secret
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Shield className="mx-auto h-12 w-12 text-primary" />
        <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Secure Share Invite</h2>
        <p className="mt-2 text-sm text-gray-600">
          Set a master password to securely receive this encrypted secret.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-200">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
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
                  disabled={loading || !token}
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
              <p className="mt-2 text-xs text-gray-500">
                This password will be used to encrypt your receiving key. Do not lose it!
              </p>
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="mt-1 relative">
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading || !token}
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

            <Button type="submit" className="w-full" disabled={loading || !token}>
              {loading ? 'Securing...' : 'Accept Secure Share'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
