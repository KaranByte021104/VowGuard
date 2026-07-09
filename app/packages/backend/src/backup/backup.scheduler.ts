import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class BackupScheduler {
  private readonly logger = new Logger(BackupScheduler.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue('backupQueue') private backupQueue: Queue
  ) {}

  // Runs every hour
  @Cron(CronExpression.EVERY_HOUR)
  async handleCron() {
    this.logger.debug('Checking for scheduled backups...');
    
    const now = new Date();
    
    // Find configs where nextScheduledRun is null OR nextScheduledRun <= now
    const configs = await this.prisma.backupConfig.findMany({
      where: {
        OR: [
          { nextScheduledRun: null },
          { nextScheduledRun: { lte: now } }
        ]
      }
    });

    for (const config of configs) {
      this.logger.log(`Enqueuing backup for user ${config.userId}`);
      await this.backupQueue.add(
        'runBackup',
        { userId: config.userId },
        {
          jobId: `backup-${config.userId}-${new Date().toISOString()}`, // Prevent exact duplicates
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 60000, // 1 minute, 2 minutes, 4 minutes
          },
        }
      );
    }
  }
}
