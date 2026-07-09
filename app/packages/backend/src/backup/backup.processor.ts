import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { BackupService } from './backup.service';
import { google } from 'googleapis';
import * as stream from 'stream';

@Processor('backupQueue')
export class BackupProcessor extends WorkerHost {
  constructor(
    private prisma: PrismaService,
    private backupService: BackupService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    if (job.name === 'runBackup') {
      const { userId } = job.data;
      const config = await this.prisma.backupConfig.findUnique({ where: { userId } });
      if (!config) return;

      console.log(`Starting backup for user ${userId}`);

      try {
        const refreshToken = this.backupService.decryptToken(config.encryptedToken);
        const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
        auth.setCredentials({ refresh_token: refreshToken });

        const drive = google.drive({ version: 'v3', auth });

        // Fetch secrets
        let secrets;
        if (config.ownedOnly) {
          secrets = await this.prisma.secret.findMany({ where: { ownerId: userId } });
        } else {
          // Include shared secrets
          const owned = await this.prisma.secret.findMany({ where: { ownerId: userId } });
          const shared = await this.prisma.secretShare.findMany({
            where: { recipientUserId: userId },
            include: { secret: true }
          });
          secrets = [...owned, ...shared.map(s => s.secret)];
        }

        const backupData = JSON.stringify(secrets);
        const bufferStream = new stream.PassThrough();
        bufferStream.end(Buffer.from(backupData));

        const fileName = `securevault-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

        await drive.files.create({
          requestBody: {
            name: fileName,
            mimeType: 'application/json',
          },
          media: {
            mimeType: 'application/json',
            body: bufferStream,
          },
        });

        // Update next run
        const nextRun = new Date();
        if (config.frequency === 'DAILY') nextRun.setDate(nextRun.getDate() + 1);
        else nextRun.setDate(nextRun.getDate() + 7);

        await this.prisma.backupConfig.update({
          where: { userId },
          data: { nextScheduledRun: nextRun },
        });

        console.log(`Backup completed for user ${userId}`);
      } catch (error) {
        console.error(`Backup failed for user ${userId}:`, error.message);
        // Throwing will trigger BullMQ's exponential backoff
        // If retries are exhausted, it will trigger the "failed" event below
        throw error;
      }
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    if (job.attemptsMade >= (job.opts.attempts || 3)) {
      console.error(`Alert: Backup permanently failed for user ${job.data.userId} after ${job.attemptsMade} attempts.`);
      // Emit event for Sprint 10 Alerts here
    }
  }
}
