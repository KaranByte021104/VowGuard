import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats(organizationId: string) {
    const cache = await this.prisma.reportCache.findUnique({
      where: { organizationId }
    });
    
    if (cache) {
      return JSON.parse(cache.data);
    }
    
    return this.generateReportData(organizationId);
  }

  async generateReportData(organizationId: string) {
    // Basic aggregation for the 6 report types
    const totalUsers = await this.prisma.user.count({ where: { organizationId } });
    const totalSecrets = await this.prisma.secret.count({ where: { organizationId } });
    const totalShares = await this.prisma.secretShare.count({ where: { secret: { organizationId } } });
    const auditLogsCount = await this.prisma.auditLog.count({ where: { organizationId } });

    // Dummy data for PDF/CSV logic since full aggregation takes time
    const data = {
      userAccess: { total: totalUsers },
      passwordAccess: { total: totalSecrets },
      sharing: { total: totalShares },
      auditEvents: auditLogsCount,
      timestamp: new Date().toISOString()
    };

    await this.prisma.reportCache.upsert({
      where: { organizationId },
      update: { data: JSON.stringify(data), generatedAt: new Date() },
      create: { organizationId, data: JSON.stringify(data) }
    });

    return data;
  }
}
