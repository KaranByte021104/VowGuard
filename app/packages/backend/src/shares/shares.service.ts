import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SharePermission, InviteStatus } from '@prisma/client';
import * as crypto from 'crypto';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class SharesService {
  private readonly logger = new Logger(SharesService.name);

  constructor(
    private prisma: PrismaService,
    private mailerService: MailerService
  ) {}

  // We are missing the SharePermissionGuard which should verify the current user has MANAGE permission
  // or is the owner of the secret before allowing them to share it. For now, doing a basic check.
  private async checkCanManageSecret(secretId: string, userId: string, organizationId: string) {
    const secret = await this.prisma.secret.findFirst({
      where: { id: secretId, organizationId }
    });
    if (!secret) throw new NotFoundException('Secret not found');
    if (secret.isPersonal) throw new ForbiddenException('Personal secrets cannot be shared');

    if (secret.ownerId === userId) return true;

    // Check if user has a MANAGE share
    const share = await this.prisma.secretShare.findFirst({
      where: { secretId, recipientUserId: userId, permission: 'MANAGE' }
    });
    if (!share) throw new ForbiddenException('You do not have permission to manage this secret');
    return true;
  }

  async shareSecretInternal(secretId: string, recipientUserId: string, permission: SharePermission, encryptedItemKey: string, currentUserId: string, organizationId: string) {
    await this.checkCanManageSecret(secretId, currentUserId, organizationId);

    // Verify recipient is in the same organization
    const recipient = await this.prisma.user.findFirst({ where: { id: recipientUserId, organizationId } });
    if (!recipient) throw new NotFoundException('Recipient user not found');

    // Create or update share
    const existingShare = await this.prisma.secretShare.findFirst({
      where: { secretId, recipientUserId }
    });

    if (existingShare) {
      return this.prisma.secretShare.update({
        where: { id: existingShare.id },
        data: { permission, encryptedItemKey }
      });
    }

    return this.prisma.secretShare.create({
      data: {
        secretId,
        recipientUserId,
        permission,
        encryptedItemKey
      }
    });
  }

  async revokeShare(id: string, organizationId: string, currentUserId: string) {
    const share = await this.prisma.secretShare.findUnique({ where: { id }, include: { secret: true } });
    if (!share) throw new NotFoundException('Share not found');
    if (share.secret.organizationId !== organizationId) throw new ForbiddenException();

    await this.checkCanManageSecret(share.secretId, currentUserId, organizationId);

    return this.prisma.secretShare.delete({ where: { id } });
  }

  async createThirdPartyInvite(secretId: string, email: string, organizationId: string, currentUserId: string, permission: SharePermission = 'ONE_CLICK_LOGIN_ONLY') {
    await this.checkCanManageSecret(secretId, currentUserId, organizationId);

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const invite = await this.prisma.thirdPartyInvite.create({
      data: {
        secretId,
        email,
        permission,
        tokenHash,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000) // 72 hours
      }
    });

    // Send the invite email
    const inviteUrl = `http://localhost:5173/invite?token=${token}`;
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'You have been invited to access a secret on VowGuard',
        text: `You have been invited to access a secret securely. Click the link to access it: ${inviteUrl}`,
        html: `
          <h3>VowGuard Secret Share</h3>
          <p>You have been invited to access a secret securely.</p>
          <p><a href="${inviteUrl}">Click here to access it</a></p>
          <p>Or paste this link into your browser: <br/>${inviteUrl}</p>
        `,
      });
      this.logger.log(`External share invite sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send invite email to ${email}:`, error);
      // Fallback to logging for development if SMTP is not configured
      this.logger.warn(`[MOCK EMAIL] Send this link to ${email}: ${inviteUrl}`);
    }

    return { inviteId: invite.id, rawToken: token };
  }

  async acceptThirdPartyInvite(tokenHash: string, ephemeralPublicKey: string, encryptedPrivateKey: string) {
    const invite = await this.prisma.thirdPartyInvite.findUnique({ where: { tokenHash } });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.status !== 'PENDING') throw new BadRequestException('Invite is no longer pending');
    if (invite.expiresAt < new Date()) throw new BadRequestException('Invite expired');

    return this.prisma.thirdPartyInvite.update({
      where: { id: invite.id },
      data: {
        status: 'ACCEPTED',
        ephemeralPublicKey,
        encryptedPrivateKey
      }
    });
  }

  async finalizeThirdPartyInvite(id: string, encryptedItemKey: string, organizationId: string, currentUserId: string) {
    const invite = await this.prisma.thirdPartyInvite.findUnique({ where: { id }, include: { secret: true } });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.secret.organizationId !== organizationId) throw new ForbiddenException();

    await this.checkCanManageSecret(invite.secretId, currentUserId, organizationId);

    if (invite.status !== 'ACCEPTED') throw new BadRequestException('Invite must be accepted first');

    return this.prisma.thirdPartyInvite.update({
      where: { id },
      data: {
        encryptedItemKey
      }
    });
  }

  async revokeThirdPartyInvite(id: string, organizationId: string, currentUserId: string) {
    const invite = await this.prisma.thirdPartyInvite.findUnique({ where: { id }, include: { secret: true } });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.secret.organizationId !== organizationId) throw new ForbiddenException();

    await this.checkCanManageSecret(invite.secretId, currentUserId, organizationId);

    return this.prisma.thirdPartyInvite.delete({ where: { id } });
  }

  async getExternalInvite(tokenHash: string) {
    const invite = await this.prisma.thirdPartyInvite.findUnique({
      where: { tokenHash },
      include: {
        secret: {
          select: {
            id: true,
            name: true,
            encryptedData: true,
            iv: true
          }
        }
      }
    });

    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.expiresAt < new Date()) throw new BadRequestException('Invite expired');

    return {
      id: invite.id,
      status: invite.status,
      permission: invite.permission,
      encryptedPrivateKey: invite.encryptedPrivateKey,
      encryptedItemKey: invite.encryptedItemKey,
      secret: (invite.status === 'ACCEPTED' && invite.encryptedItemKey) ? invite.secret : null,
      email: invite.email
    };
  }
  async shareSecretWithGroup(
    secretId: string,
    groupId: string,
    permission: SharePermission,
    encryptedItemKeys: Record<string, string>,
    userId: string,
    organizationId: string
  ) {
    await this.checkCanManageSecret(secretId, userId, organizationId);

    const group = await this.prisma.userGroup.findFirst({
      where: { id: groupId, organizationId },
      include: { members: true }
    });

    if (!group) throw new NotFoundException('Group not found');

    const sharesToCreate = group.members
      .filter(m => encryptedItemKeys[m.userId])
      .map(m => ({
        secretId,
        recipientUserId: m.userId,
        permission,
        encryptedItemKey: encryptedItemKeys[m.userId],
        groupShareSourceId: group.id
      }));

    if (sharesToCreate.length === 0) return { success: true, count: 0 };

    // Atomic transaction
    await this.prisma.$transaction(async (tx) => {
      for (const shareData of sharesToCreate) {
        const existing = await tx.secretShare.findFirst({
          where: { secretId: shareData.secretId, recipientUserId: shareData.recipientUserId }
        });
        if (existing) {
          await tx.secretShare.update({
            where: { id: existing.id },
            data: {
              permission: shareData.permission,
              encryptedItemKey: shareData.encryptedItemKey,
              groupShareSourceId: shareData.groupShareSourceId
            }
          });
        } else {
          await tx.secretShare.create({ data: shareData });
        }
      }
    });

    return { success: true, count: sharesToCreate.length };
  }
}
