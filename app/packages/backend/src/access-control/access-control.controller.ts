import { Controller, Get, Post, Body, Param, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { AccessControlService } from './access-control.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller()
export class AccessControlController {
  constructor(private readonly accessControlService: AccessControlService) {}

  @Post('secrets/:id/access-control')
  async enableAccessControl(
    @Req() req: any,
    @Param('id') secretId: string,
    @Body() data: any
  ) {
    return this.accessControlService.enableAccessControl(secretId, req.user.id, req.user.organizationId, data);
  }

  @Post('secrets/:id/requests')
  async createRequest(
    @Req() req: any,
    @Param('id') secretId: string,
    @Body() data: any
  ) {
    return this.accessControlService.createRequest(secretId, req.user.id, req.user.organizationId, data);
  }

  @Get('secrets/:id/requests')
  async getRequests(
    @Req() req: any,
    @Param('id') secretId: string
  ) {
    return this.accessControlService.getRequests(secretId, req.user.id, req.user.organizationId);
  }

  @Get('requests/pending')
  async getMyPendingRequests(
    @Req() req: any
  ) {
    // For an approver to see requests they need to act on
    return this.accessControlService.getPendingRequestsForApprover(req.user.id, req.user.organizationId);
  }

  @Post('requests/:requestId/approve')
  async approveRequest(
    @Req() req: any,
    @Param('requestId') requestId: string,
    @Body() body: any
  ) {
    return this.accessControlService.approveRequest(requestId, req.user.id, req.user.organizationId, body.encryptedItemKey);
  }

  @Post('requests/:requestId/deny')
  async denyRequest(
    @Req() req: any,
    @Param('requestId') requestId: string
  ) {
    return this.accessControlService.denyRequest(requestId, req.user.id, req.user.organizationId);
  }
}
