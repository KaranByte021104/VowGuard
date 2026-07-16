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

  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [tempToken, setTempToken] = useState('');

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

  const processLoginData = async (data: any) => {
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
  };

  const handleFullLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUnlocking(true);
    setError('');

    try {
      setUnlockStatus('Authenticating...');
      const csrfRes = await fetch('http://localhost:3000/csrf-token', { credentials: 'include' });
      const csrfData = await csrfRes.json();
      
      const response = await fetch('http://localhost:3000/auth/login', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-csrf-token': csrfData.csrfToken
        },
        credentials: 'include',
        body: JSON.stringify({ email, loginPassword })
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.message || 'Invalid login');
      }
      
      const data = await response.json();
      
      if (data.mfaRequired) {
        setTempToken(data.tempToken);
        setMfaRequired(true);
        setIsUnlocking(false);
        setUnlockStatus('');
        return;
      }

      await processLoginData(data);
    } catch (err: any) {
      console.error(err);
      setError(`Error: ${err?.name} - ${err?.message} - ${String(err)}`);
      setIsUnlocking(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUnlocking(true);
    setError('');

    try {
      setUnlockStatus('Verifying MFA...');
      const csrfRes = await fetch('http://localhost:3000/csrf-token', { credentials: 'include' });
      const csrfData = await csrfRes.json();
      
      const response = await fetch('http://localhost:3000/auth/login/mfa', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-csrf-token': csrfData.csrfToken
        },
        credentials: 'include',
        body: JSON.stringify({ tempToken, token: mfaToken })
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.message || 'Invalid MFA token');
      }
      
      const data = await response.json();
      await processLoginData(data);
    } catch (err: any) {
      console.error(err);
      setError(`Error: ${err?.name} - ${err?.message} - ${String(err)}`);
      setIsUnlocking(false);
    }
  };

  if (loading) return <div className="p-4 text-center">Loading...</div>;

  if (session?.isUnlocked) {
    return (
      <div className="flex flex-col h-full bg-background text-foreground">
        <div className="bg-primary text-primary-foreground p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            <h1 className="font-bold tracking-tight">VowGuard</h1>
          </div>
          <button onClick={() => {
            chrome.runtime.sendMessage({ type: 'LOCK' }, () => checkSession());
          }} title="Lock Vault" className="hover:opacity-80 transition-opacity">
            <Lock className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 flex-1 flex flex-col items-center justify-center text-center">
          <Unlock className="w-12 h-12 text-status-success mb-4" />
          <h2 className="text-lg font-semibold mb-1">Vault Unlocked</h2>
          <p className="text-sm text-muted-foreground mb-6">{session.user?.email}</p>
          
          <p className="text-sm text-muted-foreground mb-4">
            Autofill is active for matching domains.
          </p>
        </div>
        <div className="p-4 border-t border-border bg-card">
          <a href="http://localhost:5173" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 text-sm font-medium text-primary hover:underline">
            Open Web Vault <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <div className="bg-primary text-primary-foreground p-4 flex items-center gap-2 shadow-sm">
        <Shield className="w-5 h-5" />
        <h1 className="font-bold tracking-tight">VowGuard</h1>
      </div>
      <div className="p-6">
        <h2 className="text-xl font-bold mb-6 text-center">Unlock Extension</h2>
        
        {mfaRequired ? (
          <form onSubmit={handleMfaSubmit} className="space-y-4">
            {error && <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm text-center font-medium">{error}</div>}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium">Authenticator Code</label>
              <input 
                type="text" 
                required 
                value={mfaToken}
                onChange={e => setMfaToken(e.target.value)}
                className="w-full border border-input bg-background rounded-md p-2 text-sm focus:ring-2 focus:ring-ring focus:border-ring transition-colors" 
                placeholder="6-digit code"
                maxLength={6}
              />
            </div>
            <button 
              type="submit" 
              disabled={isUnlocking}
              className="w-full bg-primary text-primary-foreground rounded-md p-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isUnlocking ? unlockStatus : 'Verify & Unlock'}
            </button>
            <button
              type="button"
              onClick={() => {
                setMfaRequired(false);
                setMfaToken('');
                setTempToken('');
              }}
              className="w-full bg-secondary text-secondary-foreground rounded-md p-2 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Back to Login
            </button>
          </form>
        ) : (
          <form onSubmit={handleFullLogin} className="space-y-4">
            {error && <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm text-center font-medium">{error}</div>}
            
            <div className="space-y-1.5">
              <label className="block text-sm font-medium">Email</label>
              <input 
                type="email" 
                required 
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border border-input bg-background rounded-md p-2 text-sm focus:ring-2 focus:ring-ring focus:border-ring transition-colors" 
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium">Login Password</label>
              <div className="relative">
                <input 
                  type={showLoginPassword ? "text" : "password"} 
                  required 
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  className="w-full border border-input bg-background rounded-md p-2 text-sm pr-10 focus:ring-2 focus:ring-ring focus:border-ring transition-colors" 
                  placeholder="Used to sign in"
                />
                <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground">
                  {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium">Master Password</label>
              <div className="relative">
                <input 
                  type={showMasterPassword ? "text" : "password"} 
                  required 
                  value={masterPassword}
                  onChange={e => setMasterPassword(e.target.value)}
                  className="w-full border border-input bg-background rounded-md p-2 text-sm pr-10 focus:ring-2 focus:ring-ring focus:border-ring transition-colors" 
                  placeholder="Used to decrypt your vault"
                />
                <button type="button" onClick={() => setShowMasterPassword(!showMasterPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground">
                  {showMasterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            
            <button 
              type="submit" 
              disabled={isUnlocking}
              className="w-full bg-primary text-primary-foreground rounded-md p-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 mt-2"
            >
              {isUnlocking ? unlockStatus : 'Unlock Vault'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
