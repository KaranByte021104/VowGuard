import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from './reports.service';

@Injectable()
export class ReportsScheduler {
  private readonly logger = new Logger(ReportsScheduler.name);

  constructor(
    private prisma: PrismaService,
    private reportsService: ReportsService
  ) {}

  // Nightly pre-computation for NFR-8 fast loading
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCron() {
    this.logger.debug('Running nightly report pre-computation...');
    const orgs = await this.prisma.organization.findMany({ select: { id: true } });
    
    for (const org of orgs) {
      try {
        await this.reportsService.generateReportData(org.id);
        this.logger.debug(`Pre-computed reports for org ${org.id}`);
      } catch (error) {
        this.logger.error(`Failed to pre-compute for org ${org.id}`, error);
      }
    }
  }
}
