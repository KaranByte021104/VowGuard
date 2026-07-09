import React, { useState, useEffect } from 'react';
import { Shield, Lock, Unlock, ExternalLink, Eye, EyeOff } from 'lucide-react';
import { deriveKey, decryptPrivateKey } from '@app/shared/src/crypto';

export function PopupApp() {
  const [session, setSession] = useState<{ isUnlocked: boolean; user: any } | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [email, setEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [error, setError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockStatus, setUnlockStatus] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showMasterPassword, setShowMasterPassword] = useState(false);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = () => {
    if (chrome?.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'GET_SESSION' }, (response) => {
        setSession(response);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  };

  // const handleUnlock = async (e: React.FormEvent) => { ... } // (Removed unused function outline)

  // For Sprint 11 extension unlock, let's just make the user log in completely in the popup.
  const handleFullLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUnlocking(true);
    setError('');

    try {
      setUnlockStatus('Authenticating...');
      const response = await fetch('http://localhost:3000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, loginPassword })
      });

      if (!response.ok) throw new Error('Invalid login');
      
      const data = await response.json();
      
      const base64ToArrayBuffer = (base64: string) => {
        const binaryString = self.atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
      };

      const parts = data.user.encryptedPrivateKey.split(':');
      if (parts.length !== 2) throw new Error('Invalid encrypted key format');
      const iv = new Uint8Array(base64ToArrayBuffer(parts[0]));
      const encryptedData = base64ToArrayBuffer(parts[1]);

      setUnlockStatus('Deriving key (this may take a moment)...');
      const derivedKey = await Promise.race([
        deriveKey(masterPassword, data.user.email),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Key derivation timed out. Please try again.')), 60000))
      ]);
      
      setUnlockStatus('Decrypting vault...');
      const privateKey = await decryptPrivateKey(encryptedData, iv, derivedKey);
      
      setUnlockStatus('Exporting key...');
      const exportedPrivateKey = await crypto.subtle.exportKey('pkcs8', privateKey);

      setUnlockStatus('Sending to background...');
      // Safe base64 conversion for large arrays
      let binaryString = '';
      const bytes = new Uint8Array(exportedPrivateKey);
      for (let i = 0; i < bytes.byteLength; i++) {
        binaryString += String.fromCharCode(bytes[i]);
      }
      
      chrome.runtime.sendMessage({
        type: 'UNLOCK',
        email: data.user.email,
        exportedPrivateKeyBase64: window.btoa(binaryString),
        publicKey: data.user.publicKey
      }, (res) => {
        if (chrome.runtime.lastError) {
          setError(chrome.runtime.lastError.message || 'Unlock failed');
          setIsUnlocking(false);
          return;
        }
        if (res && res.success) {
          checkSession();
        } else {
          setError(res?.error || 'Unlock failed');
        }
        setIsUnlocking(false);
      });
    } catch (err: any) {
      console.error(err);
      setError(`Error: ${err?.name} - ${err?.message} - ${String(err)}`);
      setIsUnlocking(false);
    }
  };

  if (loading) return <div className="p-4 text-center">Loading...</div>;

  if (session?.isUnlocked) {
    return (
      <div className="flex flex-col h-full bg-gray-50 text-gray-900">
        <div className="bg-blue-600 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            <h1 className="font-bold">SecureVault</h1>
          </div>
          <button onClick={() => {
            chrome.runtime.sendMessage({ type: 'LOCK' }, () => checkSession());
          }} title="Lock Vault">
            <Lock className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 flex-1 flex flex-col items-center justify-center text-center">
          <Unlock className="w-12 h-12 text-green-500 mb-4" />
          <h2 className="text-lg font-semibold mb-1">Vault Unlocked</h2>
          <p className="text-sm text-gray-500 mb-6">{session.user?.email}</p>
          
          <p className="text-sm text-gray-600 mb-4">
            Autofill is active for matching domains.
          </p>
        </div>
        <div className="p-4 border-t border-gray-200 bg-white">
          <a href="http://localhost:5173" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 text-sm text-primary hover:underline">
            Open Web Vault <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 text-gray-900">
      <div className="bg-blue-600 text-white p-4 flex items-center gap-2">
        <Shield className="w-5 h-5" />
        <h1 className="font-bold">SecureVault</h1>
      </div>
      <div className="p-6">
        <h2 className="text-xl font-bold mb-4 text-center">Unlock Extension</h2>
        
        <form onSubmit={handleFullLogin} className="space-y-4">
          {error && <div className="bg-red-50 text-red-600 p-2 rounded text-sm text-center">{error}</div>}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input 
              type="email" 
              required 
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded p-2 text-sm" 
            />
          </div>
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Login Password</label>
            <input 
              type={showLoginPassword ? "text" : "password"} 
              required 
              value={loginPassword}
              onChange={e => setLoginPassword(e.target.value)}
              className="w-full border border-gray-300 rounded p-2 text-sm pr-10" 
              placeholder="Used to sign in"
            />
            <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)} className="absolute bottom-2 right-3 flex items-center text-gray-400 hover:text-gray-600">
              {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Master Password</label>
            <input 
              type={showMasterPassword ? "text" : "password"} 
              required 
              value={masterPassword}
              onChange={e => setMasterPassword(e.target.value)}
              className="w-full border border-gray-300 rounded p-2 text-sm pr-10" 
              placeholder="Used to decrypt your vault"
            />
            <button type="button" onClick={() => setShowMasterPassword(!showMasterPassword)} className="absolute bottom-2 right-3 flex items-center text-gray-400 hover:text-gray-600">
              {showMasterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          
          <button 
            type="submit" 
            disabled={isUnlocking}
            className="w-full bg-blue-600 text-white rounded p-2 text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            {isUnlocking ? unlockStatus : 'Unlock Vault'}
          </button>
        </form>
      </div>
    </div>
  );
}
