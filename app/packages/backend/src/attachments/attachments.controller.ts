import { Controller, Post, Get, Param, UseGuards, UseInterceptors, UploadedFile, Body, Req, Res, StreamableFile, Delete } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AttachmentsService } from './attachments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Response } from 'express';

@Controller('attachments')
@UseGuards(JwtAuthGuard)
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post(':secretId')
  @UseInterceptors(FileInterceptor('file'))
  uploadAttachment(
    @Req() req: any,
    @Param('secretId') secretId: string,
    @UploadedFile() file: any,
    @Body('iv') iv: string,
    @Body('encryptedItemKey') encryptedItemKey: string
  ) {
    return this.attachmentsService.uploadAttachment(secretId, req.user.id, req.user.organizationId, file, iv, encryptedItemKey);
  }

  @Get('secret/:secretId')
  getAttachments(@Req() req: any, @Param('secretId') secretId: string) {
    return this.attachmentsService.getAttachments(secretId, req.user.id, req.user.organizationId);
  }

  @Get(':id/download')
  async downloadAttachment(@Req() req: any, @Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const { fileBuffer, attachment } = await this.attachmentsService.downloadAttachment(id, req.user.id, req.user.organizationId);
    
    res.set({
      'Content-Type': attachment.mimeType,
      'Content-Disposition': `attachment; filename="${attachment.originalName}"`,
      'X-Encryption-IV': attachment.iv,
      'X-Encryption-Key': attachment.encryptedItemKey
    });

    return new StreamableFile(fileBuffer);
  }

  @Delete(':id')
  deleteAttachment(@Req() req: any, @Param('id') id: string) {
    return this.attachmentsService.deleteAttachment(id, req.user.id, req.user.organizationId);
  }
}
