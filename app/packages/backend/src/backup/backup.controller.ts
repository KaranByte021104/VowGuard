import { Controller, Get, Post, Body, Req, Res, UseGuards, Query, Param, StreamableFile } from '@nestjs/common';
import { BackupService } from './backup.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('backup')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @UseGuards(JwtAuthGuard)
  @Get('config')
  async getConfig(@Req() req) {
    return this.backupService.getConfig(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('config')
  async updateConfig(@Req() req, @Body() body: { frequency: 'DAILY' | 'WEEKLY', ownedOnly: boolean }) {
    return this.backupService.updateConfig(req.user.id, body.frequency, body.ownedOnly);
  }

  @UseGuards(JwtAuthGuard)
  @Get('connect/google')
  async connectGoogle(@Req() req, @Res() res) {
    const url = await this.backupService.getGoogleAuthUrl(req.user.id);
    res.json({ url });
  }

  @UseGuards(JwtAuthGuard)
  @Post('callback/google')
  async googleCallback(@Req() req, @Body() body: { code: string }) {
    return this.backupService.handleGoogleCallback(req.user.id, body.code);
  }

  @UseGuards(JwtAuthGuard)
  @Post('disconnect')
  async disconnect(@Req() req) {
    return this.backupService.disconnect(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('files')
  async listFiles(@Req() req) {
    return this.backupService.listFiles(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('files/:fileId/download')
  async downloadFile(@Req() req, @Param('fileId') fileId: string, @Res({ passthrough: true }) res) {
    const stream = await this.backupService.downloadFile(req.user.id, fileId);
    res.set({
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="backup-${fileId}.json"`,
    });
    return new StreamableFile(stream);
  }
}
