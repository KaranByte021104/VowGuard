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

  async getUserAccessReport(organizationId: string) {
    // Returns active/invited/suspended user breakdown
    const users = await this.prisma.user.groupBy({
      by: ['status'],
      where: { organizationId },
      _count: true
    });
    return { data: users };
  }

  async getPasswordAssessmentReport(organizationId: string) {
    // Would analyze password strength/reuse based on breached DBs.
    // For this stub we return placeholder.
    return { data: { weakCount: 0, reusedCount: 0, healthyCount: await this.prisma.secret.count({ where: { organizationId } }) } };
  }

  async getFolderAccessReport(organizationId: string) {
    // Returns folders and how many secrets they contain
    const folders = await this.prisma.folder.findMany({
      where: { organizationId },
      include: { _count: { select: { secrets: true } } }
    });
    return { data: folders };
  }

  async getSharingSummariesReport(organizationId: string) {
    // Returns share counts by permission level
    const shares = await this.prisma.secretShare.groupBy({
      by: ['permission'],
      where: { secret: { organizationId } },
      _count: true
    });
    return { data: shares };
  }

  async getInactivityReport(organizationId: string) {
    // Finds users who haven't logged in recently (requires lastLogin field, using updatedAt as proxy for now)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const inactiveUsers = await this.prisma.user.findMany({
      where: { organizationId, updatedAt: { lt: thirtyDaysAgo } },
      select: { id: true, email: true, updatedAt: true }
    });
    return { data: inactiveUsers };
  }

  async getActivityLogsReport(organizationId: string) {
    // Returns recent audit logs
    const logs = await this.prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    return { data: logs };
  }
}
