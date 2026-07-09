import { Controller, Get, Put, Param, Body, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ControlsService } from './controls.service';

@UseGuards(JwtAuthGuard)
@Controller('controls')
export class ControlsController {
  constructor(private readonly controlsService: ControlsService) {}

  @Get()
  getControls(@Req() req) {
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Only administrators can manage controls');
    }
    return this.controlsService.getControls(req.user.organizationId);
  }

  @Put(':action')
  toggleControl(@Req() req, @Param('action') action: string, @Body('isEnabled') isEnabled: boolean) {
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Only administrators can manage controls');
    }
    return this.controlsService.toggleControl(req.user.organizationId, action, isEnabled);
  }
}
