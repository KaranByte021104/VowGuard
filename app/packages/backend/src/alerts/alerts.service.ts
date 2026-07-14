import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private prisma: PrismaService,
    private mailerService: MailerService,
  ) {}

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

  private async sendAlert(rule: any, auditLog: any) {
    let recipients: string[] = [];
    if (rule.recipientType === 'ALL_ADMINS') {
      const admins = await this.prisma.user.findMany({
        where: { organizationId: rule.organizationId, role: { in: ['ADMIN', 'SUPER_ADMIN'] } }
      });
      recipients = admins.map(admin => admin.email);
    } else {
      recipients = rule.specificUsers.map(su => su.user.email);
    }

    if (recipients.length === 0) return;

    this.logger.log(`[ALERT TRIGGERED] Rule: ${rule.name} | Event: ${auditLog.action} | To: ${recipients.join(', ')}`);

    try {
      let targetInfo = '';
      if (auditLog.details) {
        try {
          const parsedDetails = JSON.parse(auditLog.details);
          if (parsedDetails?.body?.email) {
            targetInfo = `\nTarget Email: ${parsedDetails.body.email}`;
          }
        } catch(e) {}
      }

      await this.mailerService.sendMail({
        to: recipients,
        subject: `Security Alert: ${rule.name}`,
        text: `An event matching the rule "${rule.name}" has occurred.\nAction: ${auditLog.action}\nTime: ${new Date().toISOString()}${targetInfo}`,
      });
      this.logger.log(`Successfully sent email alert to: ${recipients.join(', ')}`);
    } catch (e) {
      this.logger.error('Failed to send email alert', e);
    }
  }
}
