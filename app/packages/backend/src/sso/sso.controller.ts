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

  /**
   * GET /sso/catalog
   * Returns the list of SAML-compatible SaaS apps the admin can configure.
   * TRD Section 10.9 / FR-31.
   */
  @UseGuards(JwtAuthGuard)
  @Get('catalog')
  getSsoCatalog() {
    return [
      { id: 'okta',       name: 'Okta',          logoUrl: 'https://cdn.worldvectorlogo.com/logos/okta.svg',  description: 'Identity provider' },
      { id: 'google',     name: 'Google Workspace', logoUrl: 'https://cdn.worldvectorlogo.com/logos/google-icon.svg', description: 'G-Suite SSO' },
      { id: 'azure',      name: 'Azure AD',       logoUrl: 'https://cdn.worldvectorlogo.com/logos/azure-1.svg', description: 'Microsoft identity platform' },
      { id: 'salesforce', name: 'Salesforce',     logoUrl: 'https://cdn.worldvectorlogo.com/logos/salesforce-2.svg', description: 'CRM' },
      { id: 'github',     name: 'GitHub Enterprise', logoUrl: 'https://cdn.worldvectorlogo.com/logos/github-icon.svg', description: 'Code repository' },
      { id: 'slack',      name: 'Slack',          logoUrl: 'https://cdn.worldvectorlogo.com/logos/slack-new-logo.svg', description: 'Team communication' },
      { id: 'jira',       name: 'Jira / Atlassian', logoUrl: 'https://cdn.worldvectorlogo.com/logos/jira-1.svg', description: 'Project management' },
      { id: 'aws',        name: 'AWS IAM Identity Center', logoUrl: 'https://cdn.worldvectorlogo.com/logos/amazon-icon.svg', description: 'AWS SSO' },
      { id: 'zoom',       name: 'Zoom',           logoUrl: 'https://cdn.worldvectorlogo.com/logos/zoom-app.svg', description: 'Video conferencing' },
      { id: 'notion',     name: 'Notion',         logoUrl: 'https://cdn.worldvectorlogo.com/logos/notion-2.svg', description: 'Workspace notes' },
    ];
  }

  /**
   * POST /sso/apps/:id/logout
   * SAML Single Logout (SLO) — TRD Section 10.9 / FR-31.
   * Returns a logout URL the client should redirect to for IdP-side logout.
   */
  @UseGuards(JwtAuthGuard)
  @Post('apps/:id/logout')
  async samlLogout(@Req() req, @Param('id') id: string) {
    const app = await this.ssoService.getSamlApp(id, req.user.organizationId);
    // Return a SAML SLO redirect URL pointing back to the app's ACS endpoint
    // In a full implementation this would generate a signed SAML LogoutRequest.
    return {
      logoutUrl: `${app.acsUrl}?SAMLRequest=logout&issuer=${encodeURIComponent(app.audienceUri)}`,
      message: 'Redirect user to logoutUrl to complete SAML single logout'
    };
  }
}
