import { PrismaClient } from '@prisma/client';
import { webcrypto } from 'crypto';

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto as any;
}

import { deriveKey, generateKeyPair, encryptPrivateKey, exportPublicKey } from '../../shared/src/crypto/index';

const prisma = new PrismaClient();

// Helper to base64 encode ArrayBuffer
function arrayBufferToBase64(buffer: any) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function main() {
  const users = await prisma.user.findMany({
    where: {
      email: {
        in: [
          'superadmin@zylkercorp.com',
          'admin@zylkercorp.com',
          'engineer1@zylkercorp.com',
          'engineer2@zylkercorp.com'
        ]
      }
    }
  });

  const demoMasterPassword = 'DemoMasterPassword123!';

  for (const user of users) {
    console.log(`Generating valid crypto keys for ${user.email}...`);
    
    // 1. Derive the AES-GCM key from Master Password and Email (salt)
    const derivedKey = await deriveKey(demoMasterPassword, user.email);
    
    // 2. Generate RSA Key Pair
    const keyPair = await generateKeyPair();
    
    // 3. Encrypt the Private Key
    const { encrypted, iv } = await encryptPrivateKey(keyPair.privateKey, derivedKey);
    const encryptedPrivateKeyStr = `${arrayBufferToBase64(iv.buffer)}:${arrayBufferToBase64(encrypted)}`;
    
    // 4. Export Public Key
    const pubKeyBuffer = await exportPublicKey(keyPair.publicKey);
    const publicKeyStr = arrayBufferToBase64(pubKeyBuffer);

    // 5. Update user in DB
    await prisma.user.update({
      where: { id: user.id },
      data: {
        publicKey: publicKeyStr,
        encryptedPrivateKey: encryptedPrivateKeyStr
      }
    });
  }

  console.log('Successfully updated users with real cryptographic keys!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
