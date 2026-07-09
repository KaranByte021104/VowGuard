const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const secrets = await prisma.secret.findMany({ include: { owner: true } });
  console.log(secrets.map(s => ({
    id: s.id,
    name: s.name,
    ownerEmail: s.owner.email,
    ownerId: s.owner.id
  })));
}

main().finally(() => prisma.$disconnect());
