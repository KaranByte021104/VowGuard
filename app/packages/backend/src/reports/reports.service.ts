import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats(organizationId: string, userId: string) {
    const totalUsers = await this.prisma.user.count({ where: { organizationId } });
    const totalSecrets = await this.prisma.secret.count({ where: { organizationId } });
    const totalFolders = await this.prisma.folder.count({ where: { organizationId } });

    // Team stats
    const teamSecrets = await this.prisma.secret.findMany({
      where: { organizationId },
      select: {
        id: true, passwordScore: true, isWeak: true, isReused: true,
        containsUsername: true, isDictionaryWord: true, isRecycled: true,
        createdAt: true, updatedAt: true, templateType: true, ownerId: true, isPersonal: true
      }
    });

    // Personal stats
    const personalSecrets = teamSecrets.filter(s => s.ownerId === userId);

    const calcStats = (secrets: any[]) => {
      let weak = 0, reused = 0, containsUsername = 0, old = 0, dictionary = 0, recycled = 0;
      let scoreSum = 0;
      const categories: Record<string, number> = {};

      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

      for (const s of secrets) {
        if (s.isWeak) weak++;
        if (s.isReused) reused++;
        if (s.containsUsername) containsUsername++;
        if (s.isDictionaryWord) dictionary++;
        if (s.isRecycled) recycled++;
        if (s.updatedAt < ninetyDaysAgo) old++;
        scoreSum += s.passwordScore;
        categories[s.templateType] = (categories[s.templateType] || 0) + 1;
      }

      const total = secrets.length || 1;
      // Score max is 4 per secret, normalize to 100%
      const avgScore = Math.round(((scoreSum / total) / 4) * 100);

      return {
        total: secrets.length,
        assessment: { score: avgScore, weak, reused, containsUsername, old, dictionary, recycled },
        categories
      };
    };

    const team = calcStats(teamSecrets);
    const personal = calcStats(personalSecrets);

    // Calculate Owned, Shared by me, Shared with me, Unshared
    const owned = personalSecrets.length;
    
    // Actually, "shared with me" requires checking shares
    const sharedWithMe = await this.prisma.secretShare.count({
      where: { recipientUserId: userId }
    });

    const sharedByMe = await this.prisma.secretShare.findMany({
      where: { secret: { ownerId: userId } },
      select: { secretId: true },
      distinct: ['secretId']
    }).then(res => res.length);

    const unshared = owned - sharedByMe;
    const personalOnly = personalSecrets.filter(s => s.isPersonal).length;

    const totalShares = await this.prisma.secretShare.count({ where: { secret: { organizationId } } });
    const auditLogsCount = await this.prisma.auditLog.count({ where: { organizationId } });

    const data = {
      userAccess: { total: totalUsers },
      passwordAccess: { total: totalSecrets },
      folders: { total: totalFolders },
      sharing: { total: totalShares },
      auditEvents: auditLogsCount,
      team,
      personal,
      overview: {
        owned, sharedByMe, sharedWithMe, unshared, personal: personalOnly
      }
    };

    return data;
  }

  async generateReportData(organizationId: string) {
    // Basic aggregation for cron job
    const totalUsers = await this.prisma.user.count({ where: { organizationId } });
    const totalSecrets = await this.prisma.secret.count({ where: { organizationId } });
    const totalShares = await this.prisma.secretShare.count({ where: { secret: { organizationId } } });
    const auditLogsCount = await this.prisma.auditLog.count({ where: { organizationId } });

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
    const secrets = await this.prisma.secret.findMany({
      where: { organizationId },
      select: { id: true, encryptedData: true, name: true }
    });

    // Reuse detection: secrets with identical ciphertext are duplicates
    const dataCounts = new Map<string, number>();
    for (const s of secrets) {
      if (s.encryptedData) {
        dataCounts.set(s.encryptedData, (dataCounts.get(s.encryptedData) || 0) + 1);
      }
    }
    const reusedIds = new Set(
      secrets.filter(s => s.encryptedData && (dataCounts.get(s.encryptedData) || 0) > 1).map(s => s.id)
    );

    // Weak proxy: title suggests a trivially simple credential (e.g., "test", "admin", "pass")
    const weakKeywords = ['test', 'admin', 'pass', 'password', '123', 'temp', 'demo'];
    const weakIds = new Set(
      secrets.filter(s => weakKeywords.some(k => s.name?.toLowerCase().includes(k))).map(s => s.id)
    );

    const reusedCount = reusedIds.size;
    const weakCount = [...weakIds].filter(id => !reusedIds.has(id)).length;
    const healthyCount = secrets.length - reusedCount - weakCount;

    return { data: { weakCount, reusedCount, healthyCount: Math.max(0, healthyCount), total: secrets.length } };
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
