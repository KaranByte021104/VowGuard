import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('alerts')
@UseGuards(JwtAuthGuard)
export class AlertsController {
  constructor(
    private readonly alertsService: AlertsService,
    private readonly prisma: PrismaService
  ) {}

  @Get('rules')
  async getRules(@Request() req: any) {
    return this.prisma.notificationRule.findMany({
      where: { organizationId: req.user.organizationId }
    });
  }

  @Post('rules')
  async saveRule(@Request() req: any, @Body() body: any) {
    if (body.id) {
      return this.prisma.notificationRule.update({
        where: { id: body.id, organizationId: req.user.organizationId },
        data: {
          name: body.name,
          eventTypes: body.eventTypes,
          recipientType: body.recipientType,
          timing: body.timing,
          isEnabled: body.isEnabled
        }
      });
    } else {
      return this.prisma.notificationRule.create({
        data: {
          organizationId: req.user.organizationId,
          name: body.name,
          eventTypes: body.eventTypes || [],
          recipientType: body.recipientType || 'ALL_ADMINS',
          timing: body.timing || 'INSTANT',
          isEnabled: body.isEnabled !== false
        }
      });
    }
  }
}
