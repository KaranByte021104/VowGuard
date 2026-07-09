import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Req, Res, Header } from '@nestjs/common';
import { SsoService } from './sso.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RoleGuard as RolesGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import type { Response } from 'express';

@Controller('sso')
export class SsoController {
  constructor(private readonly ssoService: SsoService) {}

  @Get('metadata/:orgId')
  @Header('Content-Type', 'application/xml')
  async getMetadata(@Param('orgId') orgId: string, @Res() res: Response) {
    const metadata = await this.ssoService.generateIdpMetadata(orgId);
    res.send(metadata);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Post('apps')
  async createApp(@Req() req, @Body() data: { name: string; description?: string; acsUrl: string; audienceUri: string; }) {
    return this.ssoService.createSamlApp(req.user.organizationId, data);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Get('apps')
  async getApps(@Req() req) {
    return this.ssoService.getSamlApps(req.user.organizationId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Get('apps/:id')
  async getApp(@Req() req, @Param('id') id: string) {
    return this.ssoService.getSamlApp(id, req.user.organizationId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Put('apps/:id')
  async updateApp(@Req() req, @Param('id') id: string, @Body() data: any) {
    return this.ssoService.updateSamlApp(id, req.user.organizationId, data);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Post('apps/:id/access/:userId')
  async grantAccess(@Req() req, @Param('id') id: string, @Param('userId') userId: string) {
    return this.ssoService.grantAccess(id, userId, req.user.organizationId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Delete('apps/:id/access/:userId')
  async revokeAccess(@Req() req, @Param('id') id: string, @Param('userId') userId: string) {
    return this.ssoService.revokeAccess(id, userId, req.user.organizationId);
  }

  // User endpoints
  @UseGuards(JwtAuthGuard)
  @Get('my-apps')
  async getMyApps(@Req() req) {
    return this.ssoService.getUserAccessibleApps(req.user.id, req.user.organizationId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('login/:appId')
  async initiateLogin(@Req() req, @Param('appId') appId: string) {
    return this.ssoService.initiateSamlLogin(req.user.id, req.user.organizationId, appId);
  }
}
