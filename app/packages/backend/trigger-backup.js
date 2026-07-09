const { PrismaClient } = require('@prisma/client');
const { Queue } = require('bullmq');

const prisma = new PrismaClient();
const backupQueue = new Queue('backupQueue', { connection: { host: 'localhost', port: 6379 } });

async function run() {
  console.log('Fetching backup configs...');
  const configs = await prisma.backupConfig.findMany();
  
  if (configs.length === 0) {
    console.log('No backup configs found. Make sure you connected Google Drive first.');
    return;
  }

  for (const config of configs) {
    console.log(`Triggering backup for User: ${config.userId}`);
    await backupQueue.add('runBackup', { userId: config.userId });
  }
  
  console.log('Jobs successfully added to the backupQueue!');
  await prisma.$disconnect();
  await backupQueue.close();
}

run().catch(console.error);
