const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  if (users.length <= 1) {
    console.log('Not enough users to merge.');
    return;
  }

  // Pick the first organization as the main one
  const mainOrgId = users[0].organizationId;
  const mainOrg = await prisma.organization.findUnique({ where: { id: mainOrgId } });
  
  console.log(`Moving all users to Organization: ${mainOrg.name} (${mainOrgId})`);

  for (const user of users) {
    if (user.organizationId !== mainOrgId) {
      console.log(`Moving user ${user.email} from org ${user.organizationId} to ${mainOrgId}`);
      await prisma.user.update({
        where: { id: user.id },
        data: { organizationId: mainOrgId, role: 'USER' } // Set others to standard USER or keep as SUPER_ADMIN
      });
      
      // Cleanup empty orgs if needed
      try {
        await prisma.organization.delete({ where: { id: user.organizationId } });
        console.log(`Deleted empty org ${user.organizationId}`);
      } catch(e) {
        // Might fail if there are other relations, but fine for a quick script
      }
    }
  }
  
  console.log('Done!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
