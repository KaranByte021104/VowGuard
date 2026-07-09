import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req, SetMetadata } from '@nestjs/common';
import { SecretsService } from './secrets.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SharePermissionGuard } from '../auth/share-permission.guard';
import { ControlsGuard, RequireControl } from '../controls/controls.guard';

@UseGuards(JwtAuthGuard)
@Controller('secrets')
export class SecretsController {
  constructor(private readonly secretsService: SecretsService) {}

  @Post()
  createSecret(@Req() req: any, @Body() data: any) {
    return this.secretsService.createSecret(req.user.id, req.user.organizationId, data);
  }

  @Get()
  getSecrets(@Req() req: any) {
    return this.secretsService.getSecrets(req.user.id, req.user.organizationId);
  }

  @Get('export')
  @UseGuards(ControlsGuard)
  @RequireControl('EXPORT_SECRETS')
  exportSecrets(@Req() req: any) {
    return this.secretsService.exportSecrets(req.user.id, req.user.organizationId);
  }

  @Get(':id')
  @UseGuards(SharePermissionGuard)
  @SetMetadata('requireSharePermission', 'VIEW')
  getSecret(@Req() req: any, @Param('id') id: string) {
    return this.secretsService.getSecret(id, req.user.id, req.user.organizationId);
  }

  @Get(':id/versions')
  @UseGuards(SharePermissionGuard)
  @SetMetadata('requireSharePermission', 'VIEW')
  getSecretVersions(@Req() req: any, @Param('id') id: string) {
    return this.secretsService.getSecretVersions(id, req.user.id, req.user.organizationId);
  }

  @Post(':id/versions/:versionId/restore')
  @UseGuards(SharePermissionGuard)
  @SetMetadata('requireSharePermission', 'MODIFY')
  restoreSecretVersion(@Req() req: any, @Param('id') id: string, @Param('versionId') versionId: string) {
    return this.secretsService.restoreSecretVersion(id, versionId, req.user.id, req.user.organizationId);
  }

  @Put(':id')
  @UseGuards(SharePermissionGuard)
  @SetMetadata('requireSharePermission', 'MODIFY')
  updateSecret(@Req() req: any, @Param('id') id: string, @Body() data: any) {
    return this.secretsService.updateSecret(id, req.user.id, req.user.organizationId, data);
  }

  @Delete(':id')
  @UseGuards(SharePermissionGuard)
  @SetMetadata('requireSharePermission', 'MANAGE')
  deleteSecret(@Req() req: any, @Param('id') id: string) {
    return this.secretsService.deleteSecret(id, req.user.organizationId);
  }
}
