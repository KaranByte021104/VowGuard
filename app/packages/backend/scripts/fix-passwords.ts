import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const demoMasterPassword = 'DemoMasterPassword123!';
  const hashedPassword = await argon2.hash(demoMasterPassword);

  const result = await prisma.user.updateMany({
    where: {
      email: {
        in: [
          'superadmin@zylkercorp.com',
          'admin@zylkercorp.com',
          'engineer1@zylkercorp.com',
          'engineer2@zylkercorp.com'
        ]
      }
    },
    data: {
      loginPassword: hashedPassword
    }
  });

  console.log(`Successfully updated ${result.count} users with the correct Argon2 hash for DemoMasterPassword123!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
