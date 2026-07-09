import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(private prisma: PrismaService) {}

  async processAuditLog(auditLog: any) {
    try {
      // Find all rules for this organization
      const rules = await this.prisma.notificationRule.findMany({
        where: { 
          organizationId: auditLog.organizationId,
          isEnabled: true
        },
        include: { specificUsers: { include: { user: true } } }
      });

      for (const rule of rules) {
        // If eventTypes contains the action (or wildcard)
        if (rule.eventTypes.includes(auditLog.action) || rule.eventTypes.includes('*')) {
          if (rule.timing === 'INSTANT') {
            this.sendAlert(rule, auditLog);
          } else {
            // DAILY_DIGEST would be processed by a separate cron job aggregating recent logs
          }
        }
      }
    } catch (e) {
      this.logger.error('Failed to process alert rules', e);
    }
  }

  private sendAlert(rule: any, auditLog: any) {
    // In a real implementation, this would use Nodemailer and Socket.io
    // Since we are mocking email for sprint 10 demo as requested:
    let recipients: string[] = [];
    if (rule.recipientType === 'ALL_ADMINS') {
      recipients.push('all-admins@example.com');
    } else {
      recipients = rule.specificUsers.map(su => su.user.email);
    }

    this.logger.log(`[ALERT TRIGGERED] Rule: ${rule.name} | Event: ${auditLog.action} | To: ${recipients.join(', ')}`);
  }
}
