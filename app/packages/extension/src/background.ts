/// <reference types="chrome" />
import { importPublicKey, encryptSecretPayload, decryptSecretPayload, decryptItemKeyWithPrivateKey, encryptItemKeyWithPublicKey, generateItemKey } from '@app/shared/src/crypto';

// Keep the session key in memory ONLY. Never write to storage.
let sessionKeys: { privateKey: CryptoKey, publicKey: CryptoKey } | null = null;
let sessionUser: any = null;

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === 'UNLOCK') {
    handleUnlock(request.email, request.exportedPrivateKeyBase64, request.publicKey)
      .then(success => sendResponse({ success }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep message channel open for async
  }
  
  if (request.type === 'GET_SESSION') {
    sendResponse({ 
      isUnlocked: sessionKeys !== null, 
      user: sessionUser 
    });
    return false;
  }
  
  if (request.type === 'LOCK') {
    sessionKeys = null;
    sessionUser = null;
    sendResponse({ success: true });
    return false;
  }

  if (request.type === 'CHECK_CREDENTIALS') {
    if (!sessionKeys) {
      sendResponse({ hasCredentials: false, error: 'Locked' });
      return false;
    }
    
    // Exact origin matching
    const origin = request.origin; 
    
    // Fetch from localhost API directly since we share cookies
    fetch('http://localhost:3000/secrets', { credentials: 'include' })
      .then(res => res.json())
      .then(async secrets => {
        const normalize = (d: string) => {
          if (!d) return '';
          let n = d.toLowerCase();
          if (n.startsWith('http://')) n = n.substring(7);
          if (n.startsWith('https://')) n = n.substring(8);
          if (n.startsWith('www.')) n = n.substring(4);
          if (n.endsWith('/')) n = n.slice(0, -1);
          return n;
        };
        const matchingSecrets = secrets.filter((s: any) => {
          const sDom = normalize(s.domain);
          const oDom = normalize(origin);
          return oDom === sDom || oDom.endsWith('.' + sDom);
        });
        
        if (matchingSecrets.length > 0) {
          // Decrypt in memory and return
          const secret = matchingSecrets[0]; // Take first match for simple autofill
          try {
            const base64ToArrayBuffer = (base64: string) => {
              const binaryString = self.atob(base64);
              const len = binaryString.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              return bytes.buffer;
            };

            const itemKeyEncrypted = base64ToArrayBuffer(secret.encryptedItemKey);
            const itemKey = await decryptItemKeyWithPrivateKey(itemKeyEncrypted, sessionKeys!.privateKey);
            
            const iv = new Uint8Array(base64ToArrayBuffer(secret.iv));
            const data = base64ToArrayBuffer(secret.encryptedData);
            
            const decryptedObj = await decryptSecretPayload(data, iv, itemKey);
            
            sendResponse({ 
              hasCredentials: true, 
              credentials: {
                username: decryptedObj.username,
                password: decryptedObj.password
              }
            });
          } catch (e) {
            console.error('Decryption failed', e);
            sendResponse({ hasCredentials: false, error: 'Decryption failed' });
          }
        } else {
          sendResponse({ hasCredentials: false });
        }
      })
      .catch(err => {
        console.error('Failed to fetch secrets', err);
        sendResponse({ hasCredentials: false, error: err.message });
      });
      
    return true; // async
  }
  
  if (request.type === 'SAVE_CREDENTIAL') {
    if (!sessionKeys) {
      sendResponse({ success: false, error: 'Locked' });
      return false;
    }
    
    handleSaveCredential(request.origin, request.username, request.password)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
      
    return true; // async
  }
});

async function handleUnlock(email: string, exportedPrivateKeyBase64: string, publicKeyBase64: string) {
  const base64ToArrayBuffer = (base64: string) => {
    const binaryString = self.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  const pkcs8Buffer = base64ToArrayBuffer(exportedPrivateKeyBase64);
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    pkcs8Buffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['decrypt']
  );
  
  const publicKey = await importPublicKey(base64ToArrayBuffer(publicKeyBase64));
  
  sessionKeys = { privateKey, publicKey };
  sessionUser = { email };
  return true;
}

async function handleSaveCredential(origin: string, username: string, password: string) {
  const itemKey = await generateItemKey();
  const secretPayload = { username, password };
  const encrypted = await encryptSecretPayload(secretPayload, itemKey);
  
  const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return self.btoa(binary);
  };

  const encryptedItemKey = await encryptItemKeyWithPublicKey(itemKey, sessionKeys!.publicKey);

  const csrfRes = await fetch('http://localhost:3000/csrf-token', { credentials: 'include' });
  const csrfData = await csrfRes.json();

  const response = await fetch('http://localhost:3000/secrets', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'x-csrf-token': csrfData.csrfToken
    },
    credentials: 'include',
    body: JSON.stringify({
      name: `Saved from ${origin}`,
      domain: origin,
      encryptedData: arrayBufferToBase64(encrypted.encryptedData),
      iv: arrayBufferToBase64(encrypted.iv.buffer as ArrayBuffer),
      encryptedItemKey: arrayBufferToBase64(encryptedItemKey)
    })
  });
  
  if (!response.ok) {
    throw new Error('Failed to save to backend');
  }
}
