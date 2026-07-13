const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  
  // We'll assume the primary user who keeps the main org is the one created first
  const primaryUserId = users.find(u => u.email === '4321.stkabirdio@gmail.com')?.id || users[0].id;
  const mainOrgId = users.find(u => u.id === primaryUserId).organizationId;

  console.log('Undoing merge...');
  
  for (const user of users) {
    if (user.id !== primaryUserId) {
      console.log(`Moving user ${user.email} back to their own organization...`);
      
      // Create a new organization for this user
      const newOrg = await prisma.organization.create({
        data: {
          name: `${user.email}'s Vault`,
          type: 'TEAMS'
        }
      });
      
      // Move user to the new org and restore SUPER_ADMIN role (which is what Signup does)
      await prisma.user.update({
        where: { id: user.id },
        data: { 
          organizationId: newOrg.id,
          role: 'SUPER_ADMIN'
        }
      });
      console.log(`Created new org ${newOrg.id} and moved user ${user.email} into it as SUPER_ADMIN.`);
    } else {
      // If the primary user demoted themselves to ADMIN (which they mentioned doing), restore them to SUPER_ADMIN
      // so they don't get locked out of admin controls if they were the only one left.
      if (user.role !== 'SUPER_ADMIN') {
        await prisma.user.update({
          where: { id: user.id },
          data: { role: 'SUPER_ADMIN' }
        });
        console.log(`Restored primary user ${user.email} to SUPER_ADMIN.`);
      }
    }
  }
  
  console.log('Done undoing the merge!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
