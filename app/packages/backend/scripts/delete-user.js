const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Please provide an email address to delete.');
    console.error('Usage: node delete-user.js <email>');
    process.exit(1);
  }

  console.log(`Looking for user with email: ${email}...`);
  const user = await prisma.user.findUnique({
    where: { email },
    include: { organization: true }
  });

  if (!user) {
    console.error(`User with email ${email} not found.`);
    process.exit(1);
  }

  try {
    // Disable triggers on AuditLog to allow the CASCADE/SetNull operations
    await prisma.$executeRaw`ALTER TABLE "AuditLog" DISABLE TRIGGER ALL;`;
    console.log('Disabled AuditLog triggers temporarily...');

    // Delete the user (this will cascade and update AuditLog userId to null)
    await prisma.user.delete({
      where: { id: user.id }
    });
    console.log(`Successfully deleted user: ${email}`);

    // Optional: If they were the only user in their organization, delete the org too
    const remainingUsers = await prisma.user.count({
      where: { organizationId: user.organizationId }
    });

    if (remainingUsers === 0) {
      await prisma.organization.delete({
        where: { id: user.organizationId }
      });
      console.log(`Also deleted their empty organization (${user.organization.name}).`);
    }
  } finally {
    // ALWAYS re-enable triggers
    await prisma.$executeRaw`ALTER TABLE "AuditLog" ENABLE TRIGGER ALL;`;
    console.log('Re-enabled AuditLog triggers.');
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
