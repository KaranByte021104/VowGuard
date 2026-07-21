/// <reference types="chrome" />
import { importPublicKey, encryptSecretPayload, decryptSecretPayload, decryptItemKeyWithPrivateKey, encryptItemKeyWithPublicKey, generateItemKey } from '@app/shared/src/crypto';

// Keep the session key in memory ONLY. Never write to storage.
let sessionKeys: { privateKey: CryptoKey, publicKey: CryptoKey } | null = null;
let sessionUser: any = null;

async function restoreSession() {
  if (sessionKeys) return true;
  const data = await chrome.storage.session.get('vowGuardSession');
  if (data.vowGuardSession) {
    const { email, exportedPrivateKeyBase64, publicKeyBase64 } = data.vowGuardSession;
    
    const base64ToArrayBuffer = (base64: string) => {
      const binaryString = self.atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    };

    try {
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
    } catch (e) {
      console.error('Failed to restore session keys', e);
      return false;
    }
  }
  return false;
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === 'UNLOCK') {
    handleUnlock(request.email, request.exportedPrivateKeyBase64, request.publicKey)
      .then(success => sendResponse({ success }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep message channel open for async
  }
  
  if (request.type === 'GET_SESSION') {
    restoreSession().then(hasSession => {
      sendResponse({ 
        isUnlocked: hasSession, 
        user: sessionUser 
      });
    });
    return true;
  }
  
  if (request.type === 'LOCK') {
    sessionKeys = null;
    sessionUser = null;
    chrome.storage.session.remove('vowGuardSession').then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.type === 'CHECK_CREDENTIALS') {
    restoreSession().then(hasSession => {
      if (!hasSession) {
        sendResponse({ hasCredentials: false, error: 'Locked' });
        return;
      }
      
      const origin = request.origin; 
      
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
            const secret = matchingSecrets[0];
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

              let targetItemKeyBase64 = secret.encryptedItemKey;
              if (secret.shares && secret.shares.length > 0) {
                targetItemKeyBase64 = secret.shares[0].encryptedItemKey;
              } else if (secret.accessRequests && secret.accessRequests.length > 0 && secret.accessRequests[0].encryptedItemKey) {
                targetItemKeyBase64 = secret.accessRequests[0].encryptedItemKey;
              }

              const itemKeyEncrypted = base64ToArrayBuffer(targetItemKeyBase64);
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
    });
      
    return true; // async
  }
  
  if (request.type === 'GET_ALL_SECRETS') {
    restoreSession().then(hasSession => {
      if (!hasSession) {
        sendResponse({ success: false, error: 'Locked' });
        return;
      }

      fetch('http://localhost:3000/secrets', { credentials: 'include' })
        .then(res => res.json())
        .then(async secrets => {
          const decryptedSecrets = [];
          const base64ToArrayBuffer = (base64: string) => {
            const binaryString = self.atob(base64);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            return bytes.buffer;
          };

          for (const secret of secrets) {
            try {
              let targetItemKeyBase64 = secret.encryptedItemKey;
              if (secret.shares && secret.shares.length > 0) {
                targetItemKeyBase64 = secret.shares[0].encryptedItemKey;
              } else if (secret.accessRequests && secret.accessRequests.length > 0 && secret.accessRequests[0].encryptedItemKey) {
                targetItemKeyBase64 = secret.accessRequests[0].encryptedItemKey;
              }

              const itemKeyEncrypted = base64ToArrayBuffer(targetItemKeyBase64);
              const itemKey = await decryptItemKeyWithPrivateKey(itemKeyEncrypted, sessionKeys!.privateKey);
              
              const iv = new Uint8Array(base64ToArrayBuffer(secret.iv));
              const data = base64ToArrayBuffer(secret.encryptedData);
              
              const decryptedObj = await decryptSecretPayload(data, iv, itemKey);
              
              decryptedSecrets.push({
                id: secret.id,
                name: secret.name,
                domain: secret.domain,
                username: decryptedObj.username,
                password: decryptedObj.password
              });
            } catch (e) {
              console.error('Failed to decrypt a secret', e);
            }
          }
          
          sendResponse({ success: true, secrets: decryptedSecrets });
        })
        .catch(err => {
          sendResponse({ success: false, error: err.message });
        });
    });
      
    return true; // async
  }
  
  if (request.type === 'SAVE_CREDENTIAL') {
    restoreSession().then(hasSession => {
      if (!hasSession) {
        sendResponse({ success: false, error: 'Locked' });
        return;
      }
      
      handleSaveCredential(request.origin, request.username, request.password)
        .then(() => sendResponse({ success: true }))
        .catch(err => sendResponse({ success: false, error: err.message }));
    });
      
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
  
  await chrome.storage.session.set({
    vowGuardSession: {
      email,
      exportedPrivateKeyBase64,
      publicKeyBase64
    }
  });
  
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
