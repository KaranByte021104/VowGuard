import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Shield, Eye, EyeOff } from 'lucide-react';
import { deriveKey, generateKeyPair, encryptPrivateKey, exportPublicKey } from '@app/shared/src/crypto';
import { useSessionStore } from '../store/session';
import { apiFetch } from '../lib/apiFetch';

export function Signup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');
  
  const [step, setStep] = useState(1);
  const [isInviteFlow, setIsInviteFlow] = useState(false);
  const [inviteData, setInviteData] = useState<any>(null);
  const [inviteError, setInviteError] = useState('');

  const [formData, setFormData] = useState({
    email: '',
    name: '',
    loginPassword: '',
    organizationName: '',
    type: 'TEAMS',
    masterPassword: '',
  });
  const [ackChecked, setAckChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const { setKeys, setUser } = useSessionStore();

  useEffect(() => {
    if (inviteToken) {
      // Validate invite
      apiFetch(`http://localhost:3000/invitations/${inviteToken}`)
        .then(res => {
          if (!res.ok) throw new Error('Invalid or expired invite link.');
          return res.json();
        })
        .then(data => {
          setIsInviteFlow(true);
          setInviteData(data);
          setFormData(prev => ({ ...prev, email: data.email }));
        })
        .catch(e => {
          setInviteError(e.message);
        });
    }
  }, [inviteToken]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      setStep(2);
      return;
    }

    if (!ackChecked) {
      setError('You must acknowledge that the Master Password cannot be recovered.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Derive AES key from Master Password
      const derivedKey = await deriveKey(formData.masterPassword, formData.email);
      
      // 2. Generate RSA Key Pair
      const keyPair = await generateKeyPair();
      
      // 3. Encrypt the Private Key
      const { encrypted: encryptedPrivateKeyBuf, iv } = await encryptPrivateKey(keyPair.privateKey, derivedKey);
      
      // 4. Export the Public Key
      const publicKeyBuf = await exportPublicKey(keyPair.publicKey);

      // Convert buffers to base64 for transmission
      const arrayBufferToBase64 = (buffer: ArrayBufferLike) => {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
      };

      // We prefix encrypted key with IV for storage
      const ivBase64 = arrayBufferToBase64(iv.buffer);
      const encryptedKeyBase64 = arrayBufferToBase64(encryptedPrivateKeyBuf);
      const combinedEncryptedKey = `${ivBase64}:${encryptedKeyBase64}`;

      const publicKeyBase64 = arrayBufferToBase64(publicKeyBuf);

      // Send to server
      const payload: any = {
        email: formData.email,
        name: formData.name,
        loginPassword: formData.loginPassword,
        publicKey: publicKeyBase64,
        encryptedPrivateKey: combinedEncryptedKey,
      };

      if (isInviteFlow) {
        payload.inviteToken = inviteToken;
      } else {
        payload.organizationName = formData.organizationName;
        payload.type = formData.type;
      }

      const response = await apiFetch('http://localhost:3000/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Signup failed');
      }

      const data = await response.json();
      
      if (data.user?.publicKey) {
        setKeys(keyPair.privateKey, keyPair.publicKey);
        setUser(data.user);
      }

      // Automatically logged in by cookie
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'An error occurred during signup');
    } finally {
      setLoading(false);
    }
  };

  if (inviteToken && inviteError) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-2">Invalid Invite</h2>
          <p className="text-gray-600">{inviteError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Shield className="mx-auto h-12 w-12 text-primary" />
        <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
          {step === 1 ? (isInviteFlow ? `Join ${inviteData?.organizationName}` : 'Create an Organization') : 'Master Password'}
        </h2>
        {isInviteFlow && step === 1 && (
          <p className="mt-2 text-sm text-gray-600">You have been invited to join this vault.</p>
        )}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            
            {step === 1 ? (
              <>
                {!isInviteFlow && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Organization Name</label>
                    <input name="organizationName" value={formData.organizationName} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" onChange={handleChange} />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Full Name</label>
                  <input name="name" value={formData.name} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" onChange={handleChange} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email Address</label>
                  <input name="email" value={formData.email} type="email" required disabled={isInviteFlow} className={`mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 ${isInviteFlow ? 'bg-gray-100 text-gray-500' : ''}`} onChange={handleChange} />
                </div>
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700">Login Password</label>
                  <input name="loginPassword" value={formData.loginPassword} type={showLoginPassword ? "text" : "password"} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 pr-10" onChange={handleChange} />
                  <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)} className="absolute bottom-2 right-3 flex items-center text-gray-400 hover:text-gray-600">
                    {showLoginPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <button type="submit" className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-blue-700">
                  Next Step
                </button>
              </>
            ) : (
              <>
                <div className="text-sm text-gray-600 mb-4">
                  Your Master Password encrypts your vault. The server never sees this password and cannot recover it if lost.
                </div>
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700">Master Password</label>
                  <input name="masterPassword" value={formData.masterPassword} type={showPassword ? "text" : "password"} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 pr-10" onChange={handleChange} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute bottom-2 right-3 flex items-center text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input id="ack" type="checkbox" required className="focus:ring-primary h-4 w-4 text-primary border-gray-300 rounded" checked={ackChecked} onChange={(e) => setAckChecked(e.target.checked)} />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="ack" className="font-medium text-gray-700">I acknowledge that if I lose my Master Password, my data cannot be recovered.</label>
                  </div>
                </div>
                <button type="submit" disabled={loading} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-blue-700">
                  {loading ? 'Creating...' : (isInviteFlow ? 'Join VowGuard' : 'Create VowGuard')}
                </button>
              </>
            )}
          </form>
          
          <div className="mt-6 text-center">
            <Link to="/login" className="font-medium text-primary hover:text-blue-500 text-sm">
              Already have an account? Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
