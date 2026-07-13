"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const crypto = __importStar(require("crypto"));
const prisma = new client_1.PrismaClient();
const argon2 = __importStar(require("argon2"));
async function hashPassword(password) {
    return argon2.hash(password);
}
async function main() {
    console.log('Seeding database with demo data for Zylker Corp...');
    const org = await prisma.organization.create({
        data: {
            name: 'Zylker Corp',
            type: 'TEAMS',
        },
    });
    await prisma.passwordPolicy.create({
        data: {
            organizationId: org.id,
            name: 'Default Policy',
            isDefault: true,
            minLength: 12,
            requireUppercase: true,
            requireLowercase: true,
            requireNumbers: true,
            requireSymbols: true,
        }
    });
    const demoMasterPassword = 'DemoMasterPassword123!';
    const salt = crypto.randomBytes(16).toString('hex');
    const superAdmin = await prisma.user.create({
        data: {
            email: 'superadmin@zylkercorp.com',
            loginPassword: await hashPassword(demoMasterPassword),
            publicKey: 'mock-public-key',
            encryptedPrivateKey: 'mock-encrypted-private-key',
            role: 'SUPER_ADMIN',
            status: 'ACTIVE',
            organizationId: org.id,
        },
    });
    const admin = await prisma.user.create({
        data: {
            email: 'admin@zylkercorp.com',
            loginPassword: await hashPassword(demoMasterPassword),
            publicKey: 'mock-public-key',
            encryptedPrivateKey: 'mock-encrypted-private-key',
            role: 'ADMIN',
            status: 'ACTIVE',
            organizationId: org.id,
        },
    });
    const eng1 = await prisma.user.create({
        data: {
            email: 'engineer1@zylkercorp.com',
            loginPassword: await hashPassword(demoMasterPassword),
            publicKey: 'mock-public-key',
            encryptedPrivateKey: 'mock-encrypted-private-key',
            role: 'USER',
            status: 'ACTIVE',
            organizationId: org.id,
        },
    });
    const eng2 = await prisma.user.create({
        data: {
            email: 'engineer2@zylkercorp.com',
            loginPassword: await hashPassword(demoMasterPassword),
            publicKey: 'mock-public-key',
            encryptedPrivateKey: 'mock-encrypted-private-key',
            role: 'USER',
            status: 'ACTIVE',
            organizationId: org.id,
        },
    });
    const group = await prisma.userGroup.create({
        data: {
            name: 'Engineering',
            organizationId: org.id,
            members: {
                create: [
                    { userId: eng1.id },
                    { userId: eng2.id },
                ]
            }
        }
    });
    const folder = await prisma.folder.create({
        data: {
            name: 'Production Credentials',
            ownerId: eng1.id,
            organizationId: org.id,
        }
    });
    const secret1 = await prisma.secret.create({
        data: {
            name: 'AWS Production Root',
            domain: 'aws.amazon.com',
            templateType: 'WEBSITE',
            encryptedData: 'bW9jay1lbmNyeXB0ZWQtZGF0YQ==',
            iv: 'bW9jay1pdi1kYXRh',
            encryptedItemKey: 'bW9jay1lbmNyeXB0ZWQta2V5',
            ownerId: eng1.id,
            organizationId: org.id,
            isPersonal: false,
            folders: {
                create: {
                    folderId: folder.id
                }
            }
        }
    });
    await prisma.secretShare.create({
        data: {
            secretId: secret1.id,
            recipientUserId: eng2.id,
            encryptedItemKey: 'bW9jay1zaGFyZS1rZXk=',
            permission: 'VIEW',
        }
    });
    await prisma.emergencyAccessGrant.create({
        data: {
            ownerId: superAdmin.id,
            contactId: admin.id,
            sessionValidityHours: 24,
            waitingPeriodHours: 48,
            encryptedPrivateKey: 'mock-encrypted-priv-key-for-emergency',
            status: 'INACTIVE'
        }
    });
    await prisma.auditLog.create({
        data: {
            organizationId: org.id,
            userId: superAdmin.id,
            action: 'ORGANIZATION_CREATED',
            details: '{}',
        }
    });
    console.log('\n✅ Seeding complete!\n');
    console.log('=== DEMO CREDENTIALS ===');
    console.log(`Master Password (All users): ${demoMasterPassword}`);
    console.log(`- Super Admin: ${superAdmin.email}`);
    console.log(`- Admin:       ${admin.email}`);
    console.log(`- Engineer 1:  ${eng1.email}`);
    console.log(`- Engineer 2:  ${eng2.email}`);
    console.log('========================\n');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map