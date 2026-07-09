import { Controller, Post, Get, Body, Req, Delete, Param, UseGuards } from '@nestjs/common';
import { EmergencyAccessService } from './emergency-access.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('emergency-access')
export class EmergencyAccessController {
  constructor(private readonly emergencyService: EmergencyAccessService) {}

  @Post('contacts')
  async designateContact(@Req() req: any, @Body() body: { contactId: string, sessionValidityHours: number, waitingPeriodHours: number, encryptedPrivateKey: string }) {
    return this.emergencyService.designateContact(req.user.id, body.contactId, body.sessionValidityHours, body.waitingPeriodHours, body.encryptedPrivateKey);
  }

  @Get('contacts')
  async getContacts(@Req() req: any) {
    return this.emergencyService.getDesignatedContacts(req.user.id);
  }

  @Delete('contacts/:id')
  async removeContact(@Req() req: any, @Param('id') grantId: string) {
    return this.emergencyService.removeContact(req.user.id, grantId);
  }

  @Get('grants')
  async getReceivedGrants(@Req() req: any) {
    return this.emergencyService.getReceivedGrants(req.user.id);
  }

  @Post('grants/:id/trigger')
  async triggerGrant(@Req() req: any, @Param('id') grantId: string) {
    return this.emergencyService.triggerGrant(req.user.id, grantId);
  }

  @Post('grants/:id/deny')
  async denyGrant(@Req() req: any, @Param('id') grantId: string) {
    return this.emergencyService.denyGrant(req.user.id, grantId);
  }

  @Get('vault/:ownerId')
  async getEmergencyVault(@Req() req: any, @Param('ownerId') ownerId: string) {
    return this.emergencyService.getEmergencyVault(req.user.id, ownerId);
  }
}
