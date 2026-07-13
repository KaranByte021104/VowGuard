import { Controller, Get, Put, Post, Delete, Param, Body, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ControlsService } from './controls.service';

@UseGuards(JwtAuthGuard)
@Controller('controls')
export class ControlsController {
  constructor(private readonly controlsService: ControlsService) {}

  private requireAdmin(req: any) {
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Only administrators can manage controls');
    }
  }

  @Get()
  getControls(@Req() req) {
    this.requireAdmin(req);
    return this.controlsService.getControls(req.user.organizationId);
  }

  @Put(':action')
  toggleControl(@Req() req, @Param('action') action: string, @Body('isEnabled') isEnabled: boolean) {
    this.requireAdmin(req);
    return this.controlsService.toggleControl(req.user.organizationId, action, isEnabled);
  }

  @Post(':action/exemptions')
  addExemption(@Req() req, @Param('action') action: string, @Body('userId') userId: string) {
    this.requireAdmin(req);
    return this.controlsService.addExemption(req.user.organizationId, action, userId);
  }

  @Delete(':action/exemptions/:userId')
  removeExemption(@Req() req, @Param('action') action: string, @Param('userId') userId: string) {
    this.requireAdmin(req);
    return this.controlsService.removeExemption(req.user.organizationId, action, userId);
  }
}
