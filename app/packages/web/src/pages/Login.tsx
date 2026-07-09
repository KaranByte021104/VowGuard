import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff } from 'lucide-react';
import { deriveKey, decryptPrivateKey, importPublicKey } from '@app/shared/src/crypto';
import { useSessionStore } from '../store/session';

export function Login() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    email: '',
    loginPassword: '',
    masterPassword: '',
  });
  const [encryptedPrivateKey, setEncryptedPrivateKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showMasterPassword, setShowMasterPassword] = useState(false);

  const [userPayload, setUserPayload] = useState<any>(null);
  const { setKeys, setUser } = useSessionStore();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:3000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: formData.email,
          loginPassword: formData.loginPassword,
        }),
      });

      if (!response.ok) {
        throw new Error('Invalid credentials');
      }

      const data = await response.json();
      setEncryptedPrivateKey(data.user.encryptedPrivateKey);
      setUserPayload(data.user);
      setStep(2); // Move to master password unlock
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Base64 to ArrayBuffer helper
      const base64ToArrayBuffer = (base64: string) => {
        const binaryString = window.atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
      };

      const parts = encryptedPrivateKey.split(':');
      if (parts.length !== 2) throw new Error('Invalid encrypted key format');
      
      const iv = new Uint8Array(base64ToArrayBuffer(parts[0]));
      const data = base64ToArrayBuffer(parts[1]);

      const derivedKey = await deriveKey(formData.masterPassword, formData.email);
      
      // Decrypt locally - if wrong password, this fails. No server round-trip.
      const privateKey = await decryptPrivateKey(data, iv, derivedKey);
      
      console.log('Successfully unlocked private key:', privateKey);
      // In a real app, store this in session memory (Zustand)
      if (userPayload?.publicKey) {
        const spkiBuffer = base64ToArrayBuffer(userPayload.publicKey);
        const publicKey = await importPublicKey(spkiBuffer);
        setKeys(privateKey, publicKey);
        setUser(userPayload);
      }
      
      navigate('/');
    } catch (err: any) {
      console.error(err);
      setError('Incorrect Master Password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Shield className="mx-auto h-12 w-12 text-primary" />
        <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
          {step === 1 ? 'Sign in to your Vault' : 'Unlock Vault'}
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={step === 1 ? handleLoginSubmit : handleUnlockSubmit}>
            {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded">{error}</div>}
            
            {step === 1 ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input name="email" type="email" value={formData.email} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" onChange={handleChange} />
                </div>
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700">Login Password</label>
                  <input name="loginPassword" value={formData.loginPassword} type={showLoginPassword ? "text" : "password"} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 pr-10" onChange={handleChange} />
                  <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)} className="absolute bottom-2 right-3 flex items-center text-gray-400 hover:text-gray-600">
                    {showLoginPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <button type="submit" disabled={loading} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-blue-700">
                  {loading ? 'Signing in...' : 'Sign in'}
                </button>
                <div className="mt-4 text-center text-sm text-gray-600">
                  Don't have an account?{' '}
                  <button type="button" onClick={() => navigate('/signup')} className="font-medium text-primary hover:text-blue-500">
                    Sign up
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700">Master Password</label>
                  <input name="masterPassword" value={formData.masterPassword} type={showMasterPassword ? "text" : "password"} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 pr-10" onChange={handleChange} />
                  <button type="button" onClick={() => setShowMasterPassword(!showMasterPassword)} className="absolute bottom-2 right-3 flex items-center text-gray-400 hover:text-gray-600">
                    {showMasterPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <button type="submit" disabled={loading} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-blue-700">
                  {loading ? 'Unlocking...' : 'Unlock Vault'}
                </button>
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
