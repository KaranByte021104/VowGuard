"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const crypto_1 = require("crypto");
if (!globalThis.crypto) {
    globalThis.crypto = crypto_1.webcrypto;
}
const index_1 = require("../../shared/src/crypto/index");
const prisma = new client_1.PrismaClient();
function arrayBufferToBase64(buffer) {
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
        const derivedKey = await (0, index_1.deriveKey)(demoMasterPassword, user.email);
        const keyPair = await (0, index_1.generateKeyPair)();
        const { encrypted, iv } = await (0, index_1.encryptPrivateKey)(keyPair.privateKey, derivedKey);
        const encryptedPrivateKeyStr = `${arrayBufferToBase64(iv.buffer)}:${arrayBufferToBase64(encrypted)}`;
        const pubKeyBuffer = await (0, index_1.exportPublicKey)(keyPair.publicKey);
        const publicKeyStr = arrayBufferToBase64(pubKeyBuffer);
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
//# sourceMappingURL=fix-keys.js.map