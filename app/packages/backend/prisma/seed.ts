import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

import * as argon2 from 'argon2';

async function hashPassword(password: string) {
  return argon2.hash(password);
}

async function main() {
  console.log('Seeding database with demo data for Zylker Corp...');

  // 1. Organization
  const org = await prisma.organization.create({
    data: {
      name: 'Zylker Corp',
      type: 'TEAMS',
    },
  });

  // Default Password Policy
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

  // 2. Users
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

  // 3. User Group
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

  // 4. Sample Secrets & Folders
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

  // Share Secret to Engineer 2
  await prisma.secretShare.create({
    data: {
      secretId: secret1.id,
      recipientUserId: eng2.id,
      encryptedItemKey: 'bW9jay1zaGFyZS1rZXk=',
      permission: 'VIEW',
    }
  });

  // 5. Emergency Contact (Grant)
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

  // 6. Audit Logs
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
