const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const grants = await prisma.emergencyAccessGrant.findMany({
    include: { owner: true, contact: true }
  });
  console.log("Emergency Grants:");
  console.log(grants.map(g => ({
    ownerEmail: g.owner.email,
    ownerId: g.owner.id,
    contactEmail: g.contact.email,
    contactId: g.contact.id,
    status: g.status
  })));
}

main().finally(() => prisma.$disconnect());
