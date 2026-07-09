import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';

@Processor('emergency-access')
export class EmergencyAccessProcessor extends WorkerHost {
  constructor(
    private prisma: PrismaService,
    @InjectQueue('emergency-access') private emergencyQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    console.log(`[EmergencyAccessProcessor] Processing job ${job.name} for grant ${job.data.grantId}`);

    if (job.name === 'emergency-grant-activation') {
      const grant = await this.prisma.emergencyAccessGrant.findUnique({
        where: { id: job.data.grantId },
      });

      if (grant && grant.status === 'PENDING') {
        const sessionExpiresAt = new Date(Date.now() + grant.sessionValidityHours * 60 * 60 * 1000);
        await this.prisma.emergencyAccessGrant.update({
          where: { id: grant.id },
          data: {
            status: 'ACTIVE',
            sessionExpiresAt,
          },
        });
        
        console.log(`[EmergencyAccessProcessor] Grant ${grant.id} is now ACTIVE. Expiring at ${sessionExpiresAt}`);

        // Enqueue expiry job
        await this.emergencyQueue.add(
          'emergency-grant-expiry',
          { grantId: grant.id },
          { delay: grant.sessionValidityHours * 60 * 60 * 1000, jobId: `expire-${grant.id}-${Date.now()}` }
        );
      } else {
         console.log(`[EmergencyAccessProcessor] Grant ${grant?.id} is no longer PENDING (status: ${grant?.status}). Ignoring activation.`);
      }
    } else if (job.name === 'emergency-grant-expiry') {
      const grant = await this.prisma.emergencyAccessGrant.findUnique({
        where: { id: job.data.grantId },
      });

      if (grant && grant.status === 'ACTIVE') {
        await this.prisma.emergencyAccessGrant.update({
          where: { id: grant.id },
          data: {
            status: 'EXPIRED',
          },
        });
        console.log(`[EmergencyAccessProcessor] Grant ${grant.id} is now EXPIRED.`);
      }
    }
  }
}
