import { Controller, Post, Get, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { FoldersService } from './folders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('folders')
@UseGuards(JwtAuthGuard)
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Post()
  createFolder(@Request() req, @Body() body: { name: string; parentFolderId?: string }) {
    return this.foldersService.createFolder(req.user.id, req.user.organizationId, body);
  }

  @Get()
  getFolders(@Request() req) {
    return this.foldersService.getFolders(req.user.organizationId, req.user.id);
  }

  @Put(':id')
  updateFolder(@Request() req, @Param('id') id: string, @Body() body: { name?: string; parentFolderId?: string }) {
    return this.foldersService.updateFolder(id, req.user.organizationId, req.user.id, body);
  }

  @Delete(':id')
  deleteFolder(@Request() req, @Param('id') id: string) {
    return this.foldersService.deleteFolder(id, req.user.organizationId, req.user.id);
  }

  @Post(':id/secrets')
  bulkAssignSecrets(@Request() req, @Param('id') id: string, @Body() body: { secretIds: string[] }) {
    return this.foldersService.bulkAssignSecrets(id, body.secretIds, req.user.organizationId, req.user.id);
  }

  @Delete(':id/secrets/:secretId')
  removeSecretFromFolder(@Request() req, @Param('id') id: string, @Param('secretId') secretId: string) {
    return this.foldersService.removeSecretFromFolder(id, secretId, req.user.organizationId, req.user.id);
  }

  @Post(':id/share')
  shareFolder(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { recipientUserId: string; permission: any; encryptedItemKeys: Record<string, string> }
  ) {
    return this.foldersService.shareFolder(id, body.recipientUserId, body.permission, body.encryptedItemKeys, req.user.organizationId, req.user.id);
  }

  @Delete(':id/share/:recipientId')
  revokeFolderShare(
    @Request() req,
    @Param('id') id: string,
    @Param('recipientId') recipientId: string
  ) {
    return this.foldersService.revokeFolderShare(id, recipientId, req.user.organizationId, req.user.id);
  }
}
