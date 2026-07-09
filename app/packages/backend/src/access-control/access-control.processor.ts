import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

@Processor('access-control')
export class AccessControlProcessor extends WorkerHost {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { requestId } = job.data;

    if (job.name === 'auto-void') {
      const request = await this.prisma.accessRequest.findUnique({ where: { id: requestId } });
      if (request && request.status === 'PENDING') {
        await this.prisma.accessRequest.update({
          where: { id: requestId },
          data: { status: 'VOIDED' }
        });
        console.log(`[Access Control] Auto-voided request ${requestId}`);
      }
    } else if (job.name === 'auto-expire') {
      const request = await this.prisma.accessRequest.findUnique({ where: { id: requestId } });
      if (request && request.status === 'APPROVED') {
        await this.prisma.accessRequest.update({
          where: { id: requestId },
          data: { status: 'EXPIRED' }
        });
        console.log(`[Access Control] Auto-expired granted access for request ${requestId}`);
      }
    }
  }
}
