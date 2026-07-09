import { argon2id } from 'hash-wasm';

/**
 * Derives a 256-bit AES-GCM encryption key from a Master Password using Argon2id.
 * The salt should be unique per user (e.g., their email).
 */
export async function deriveKey(masterPassword: string, salt: string): Promise<CryptoKey> {
  // Use hash-wasm which avoids blob: worker CSP issues and top-level await bugs
  const hashHex = await argon2id({
    password: masterPassword,
    salt: salt,
    iterations: 2,
    memorySize: 1024 * 64, // 64 MB
    hashLength: 32, // 256 bits for AES
    parallelism: 1,
    outputType: 'hex',
  });

  const hashBytes = new Uint8Array(
    hashHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
  );

  return crypto.subtle.importKey(
    'raw',
    hashBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Generates an RSA-OAEP keypair for the user.
 */
export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]), // 65537
      hash: 'SHA-256',
    },
    true, // Extractable so we can save it
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts an exported PKCS8 private key with the derived AES key.
 */
export async function encryptPrivateKey(
  privateKey: CryptoKey,
  derivedKey: CryptoKey
): Promise<{ encrypted: ArrayBuffer; iv: Uint8Array }> {
  const exported = await crypto.subtle.exportKey('pkcs8', privateKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    derivedKey,
    exported
  );
  
  return { encrypted, iv };
}

/**
 * Decrypts the stored private key using the derived AES key.
 */
export async function decryptPrivateKey(
  encryptedData: ArrayBuffer,
  iv: Uint8Array,
  derivedKey: CryptoKey
): Promise<CryptoKey> {
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as any },
    derivedKey,
    encryptedData
  );

  return crypto.subtle.importKey(
    'pkcs8',
    decrypted,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['decrypt']
  );
}

/**
 * Exports a public key to SPKI format.
 */
export async function exportPublicKey(publicKey: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.exportKey('spki', publicKey);
}

/**
 * Imports a public key from SPKI format.
 */
export async function importPublicKey(spki: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'spki',
    spki,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['encrypt']
  );
}

/**
 * Generates a random 256-bit AES-GCM key for encrypting a specific secret item.
 */
export async function generateItemKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a payload (JSON object) with the provided ItemKey.
 */
export async function encryptSecretPayload(
  payload: any,
  itemKey: CryptoKey
): Promise<{ encryptedData: ArrayBuffer; iv: Uint8Array }> {
  const enc = new TextEncoder();
  const data = enc.encode(JSON.stringify(payload));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    itemKey,
    data
  );

  return { encryptedData, iv };
}

/**
 * Decrypts a payload with the provided ItemKey.
 */
export async function decryptSecretPayload(
  encryptedData: ArrayBuffer,
  iv: Uint8Array,
  itemKey: CryptoKey
): Promise<any> {
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as any },
    itemKey,
    encryptedData
  );

  const dec = new TextDecoder();
  return JSON.parse(dec.decode(decrypted));
}

/**
 * Encrypts the ItemKey using a user's RSA Public Key.
 */
export async function encryptItemKeyWithPublicKey(
  itemKey: CryptoKey,
  publicKey: CryptoKey
): Promise<ArrayBuffer> {
  const rawItemKey = await crypto.subtle.exportKey('raw', itemKey);
  return crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKey,
    rawItemKey
  );
}

/**
 * Decrypts the ItemKey using the user's RSA Private Key.
 */
export async function decryptItemKeyWithPrivateKey(
  encryptedItemKey: ArrayBuffer,
  privateKey: CryptoKey
): Promise<CryptoKey> {
  const rawItemKey = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    encryptedItemKey
  );

  return crypto.subtle.importKey(
    'raw',
    rawItemKey,
    { name: 'AES-GCM' },
    true,
    ['encrypt', 'decrypt']
  );
}

