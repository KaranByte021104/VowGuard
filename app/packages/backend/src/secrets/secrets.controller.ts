import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { SecretsService } from './secrets.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

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
    return this.secretsService.getSecrets(req.user.organizationId);
  }

  @Get('export')
  exportSecrets(@Req() req: any) {
    return this.secretsService.exportSecrets(req.user.id, req.user.organizationId);
  }

  @Get(':id')
  getSecret(@Req() req: any, @Param('id') id: string) {
    return this.secretsService.getSecret(id, req.user.organizationId);
  }

  @Get(':id/versions')
  getSecretVersions(@Req() req: any, @Param('id') id: string) {
    return this.secretsService.getSecretVersions(id, req.user.id, req.user.organizationId);
  }

  @Post(':id/versions/:versionId/restore')
  restoreSecretVersion(@Req() req: any, @Param('id') id: string, @Param('versionId') versionId: string) {
    return this.secretsService.restoreSecretVersion(id, versionId, req.user.id, req.user.organizationId);
  }

  @Put(':id')
  updateSecret(@Req() req: any, @Param('id') id: string, @Body() data: any) {
    return this.secretsService.updateSecret(id, req.user.id, req.user.organizationId, data);
  }

  @Delete(':id')
  deleteSecret(@Req() req: any, @Param('id') id: string) {
    return this.secretsService.deleteSecret(id, req.user.organizationId);
  }
}
