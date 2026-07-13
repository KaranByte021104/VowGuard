const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  console.log(users.map(u => ({ email: u.email, mfaType: u.mfaType, secret: !!u.mfaSecret })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
