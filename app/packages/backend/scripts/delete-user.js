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
    // The AuditLog.userId FK has onDelete: SetNull, so the audit trail stays
    // intact automatically when the user is deleted — no trigger bypass needed.
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
  } catch (e) {
    console.error('Failed to delete user:', e);
    throw e;
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
