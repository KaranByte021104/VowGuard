import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { PoliciesService } from './policies.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('policies')
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  @Get()
  getPolicies(@Req() req: any) {
    // Assuming req.user contains the user loaded by JwtStrategy
    // But JwtStrategy doesn't return organizationId!
    // Wait, we need organizationId. Let's get it from Prisma if not in user?
    // Actually, JwtStrategy should return organizationId.
    return this.policiesService.getPolicies(req.user.organizationId);
  }

  @Get('active')
  getActivePolicy(@Req() req: any) {
    return this.policiesService.getActivePolicy(req.user.organizationId);
  }

  @Post()
  createPolicy(@Req() req: any, @Body() data: any) {
    return this.policiesService.createPolicy(req.user.organizationId, data);
  }

  @Put(':id')
  updatePolicy(@Req() req: any, @Param('id') id: string, @Body() data: any) {
    return this.policiesService.updatePolicy(id, req.user.organizationId, data);
  }

  @Delete(':id')
  deletePolicy(@Req() req: any, @Param('id') id: string) {
    return this.policiesService.deletePolicy(id, req.user.organizationId);
  }
}
