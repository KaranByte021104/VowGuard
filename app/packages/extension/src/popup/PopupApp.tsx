import React, { useState, useEffect } from 'react';
import { Shield, Lock, ExternalLink, Eye, EyeOff } from 'lucide-react';
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

  const [activeTab, setActiveTab] = useState<'vault' | 'generator'>('vault');
  const [secrets, setSecrets] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [genLength, setGenLength] = useState(16);
  const [genSymbols, setGenSymbols] = useState(true);
  const [genNumbers, setGenNumbers] = useState(true);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const fetchSecrets = () => {
    chrome.runtime.sendMessage({ type: 'GET_ALL_SECRETS' }, (res) => {
      if (res && res.success) {
        setSecrets(res.secrets);
      }
    });
  };

  useEffect(() => {
    if (session?.isUnlocked) {
      fetchSecrets();
    }
  }, [session?.isUnlocked]);

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleLaunch = (domain: string) => {
    let url = domain;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    window.open(url, '_blank');
  };

  const generatePassword = () => {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ' + 
      (genNumbers ? '0123456789' : '') + 
      (genSymbols ? '!@#$%^&*()_+~`|}{[]:;?><,./-=' : '');
    let pwd = '';
    const array = new Uint32Array(genLength);
    window.crypto.getRandomValues(array);
    for (let i = 0; i < genLength; i++) {
      pwd += charset[array[i] % charset.length];
    }
    setGeneratedPassword(pwd);
  };

  if (loading) return <div className="p-4 text-center">Loading...</div>;

  if (session?.isUnlocked) {
    const filteredSecrets = secrets.filter(s => 
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (s.domain && s.domain.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
      <div className="flex flex-col h-full bg-background text-foreground h-[500px]">
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

        <div className="flex border-b border-border bg-card">
          <button 
            className={`flex-1 py-2 text-sm font-medium ${activeTab === 'vault' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab('vault')}
          >
            Vault
          </button>
          <button 
            className={`flex-1 py-2 text-sm font-medium ${activeTab === 'generator' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab('generator')}
          >
            Generator
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab === 'vault' ? (
            <>
              <div className="p-3 bg-card border-b border-border">
                <input 
                  type="text" 
                  placeholder="Search vault..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {secrets.length === 0 ? (
                  <div className="text-center p-4 text-muted-foreground text-sm mt-4">
                    Loading or no secrets found.
                  </div>
                ) : filteredSecrets.length === 0 ? (
                  <div className="text-center p-4 text-muted-foreground text-sm mt-4">
                    No secrets match your search.
                  </div>
                ) : (
                  filteredSecrets.map(secret => (
                    <div key={secret.id} className="bg-card border border-border rounded-md p-3 shadow-sm hover:border-primary/50 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div className="truncate pr-2">
                          <h3 className="font-semibold text-sm truncate">{secret.name}</h3>
                          <p className="text-xs text-muted-foreground truncate">{secret.username}</p>
                        </div>
                        {secret.domain && (
                          <button onClick={() => handleLaunch(secret.domain)} className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0" title="Launch Website">
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button 
                          onClick={() => handleCopy(secret.username, `user-${secret.id}`)}
                          className="flex-1 bg-secondary text-secondary-foreground text-xs py-1.5 rounded font-medium hover:opacity-90 transition-opacity"
                        >
                          {copied === `user-${secret.id}` ? 'Copied!' : 'Copy User'}
                        </button>
                        <button 
                          onClick={() => handleCopy(secret.password, `pass-${secret.id}`)}
                          className="flex-1 bg-primary text-primary-foreground text-xs py-1.5 rounded font-medium hover:opacity-90 transition-opacity"
                        >
                          {copied === `pass-${secret.id}` ? 'Copied!' : 'Copy Pass'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="p-4 space-y-6 flex-1 overflow-y-auto">
              <div className="bg-card border border-border rounded-md p-4 space-y-4">
                <div className="relative">
                  <input 
                    type="text" 
                    readOnly 
                    value={generatedPassword}
                    placeholder="Click generate"
                    className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm pr-20 font-mono"
                  />
                  <button 
                    onClick={() => handleCopy(generatedPassword, 'gen')}
                    disabled={!generatedPassword}
                    className="absolute right-1 top-1 bottom-1 bg-secondary text-secondary-foreground text-xs px-2 rounded font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {copied === 'gen' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                
                <button 
                  onClick={generatePassword}
                  className="w-full bg-primary text-primary-foreground py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Generate Password
                </button>
              </div>

              <div className="space-y-4 px-2">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <label>Length</label>
                    <span className="font-mono text-primary font-bold">{genLength}</span>
                  </div>
                  <input 
                    type="range" 
                    min="8" max="64" 
                    value={genLength} 
                    onChange={e => setGenLength(parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm">Include Numbers</label>
                  <input type="checkbox" checked={genNumbers} onChange={e => setGenNumbers(e.target.checked)} className="h-4 w-4" />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm">Include Symbols</label>
                  <input type="checkbox" checked={genSymbols} onChange={e => setGenSymbols(e.target.checked)} className="h-4 w-4" />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-border bg-card">
          <a href="http://localhost:5173" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
            Open Web Vault <ExternalLink className="w-3.5 h-3.5" />
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
