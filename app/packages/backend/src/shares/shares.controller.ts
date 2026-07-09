import { Controller, Post, Get, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { SharesService } from './shares.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SharePermission } from '@prisma/client';

@Controller('shares')
export class SharesController {
  constructor(private readonly sharesService: SharesService) {}

  @UseGuards(JwtAuthGuard)
  @Post('internal')
  shareSecretInternal(
    @Request() req,
    @Body() body: { secretId: string; recipientUserId: string; permission: SharePermission; encryptedItemKey: string }
  ) {
    return this.sharesService.shareSecretInternal(body.secretId, body.recipientUserId, body.permission, body.encryptedItemKey, req.user.id, req.user.organizationId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  revokeShare(@Request() req, @Param('id') id: string) {
    return this.sharesService.revokeShare(id, req.user.organizationId, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('invite')
  createThirdPartyInvite(
    @Request() req,
    @Body() body: { secretId: string; email: string; permission?: SharePermission }
  ) {
    return this.sharesService.createThirdPartyInvite(body.secretId, body.email, req.user.organizationId, req.user.id, body.permission);
  }

  @Post('invite/accept')
  acceptThirdPartyInvite(@Body() body: { tokenHash: string; ephemeralPublicKey: string; encryptedPrivateKey: string }) {
    return this.sharesService.acceptThirdPartyInvite(body.tokenHash, body.ephemeralPublicKey, body.encryptedPrivateKey);
  }

  @UseGuards(JwtAuthGuard)
  @Post('invite/:id/finalize')
  finalizeThirdPartyInvite(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { encryptedItemKey: string }
  ) {
    return this.sharesService.finalizeThirdPartyInvite(id, body.encryptedItemKey, req.user.organizationId, req.user.id);
  }
}
