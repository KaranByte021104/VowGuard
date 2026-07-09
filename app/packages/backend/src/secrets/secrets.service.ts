import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SecretsService {
  constructor(private prisma: PrismaService) {}

  async createSecret(userId: string, organizationId: string, data: any) {
    return this.prisma.secret.create({
      data: {
        ownerId: userId,
        organizationId,
        templateType: data.templateType,
        name: data.name,
        domain: data.domain,
        encryptedData: data.encryptedData,
        iv: data.iv,
        encryptedItemKey: data.encryptedItemKey,
        isPersonal: data.isPersonal || false,
        accessControlEnabled: data.accessControlEnabled || false,
        ...(data.folderId ? {
          folders: {
            create: {
              folderId: data.folderId
            }
          }
        } : {})
      }
    });
  }

  async getSecrets(userId: string, organizationId: string) {
    return this.prisma.secret.findMany({
      where: { 
        organizationId,
        OR: [
          { ownerId: userId },
          { shares: { some: { recipientUserId: userId } } }
        ]
      },
      orderBy: { createdAt: 'desc' },
      include: { 
        folders: true,
        shares: {
          where: { recipientUserId: userId }
        }
      }
    });
  }

  async getSecret(id: string, organizationId: string) {
    const secret = await this.prisma.secret.findFirst({
      where: { id, organizationId },
      include: {
        shares: {
          include: { recipientUser: true }
        },
        thirdPartyInvites: true
      }
    });
    if (!secret) throw new NotFoundException('Secret not found');
    return secret;
  }

  async exportSecrets(userId: string, organizationId: string) {
    return this.prisma.secret.findMany({
      where: { ownerId: userId, organizationId },
      orderBy: { createdAt: 'asc' }
    });
  }

  async updateSecret(id: string, userId: string, organizationId: string, data: any) {
    const secret = await this.prisma.secret.findFirst({
      where: { id, organizationId }
    });
    if (!secret) throw new NotFoundException('Secret not found');

    // Currently anyone in the org can update if no access control is enforced
    // For Sprint 3, owner or anyone can update. Let's just update.
    // Create a new version before updating
    await this.prisma.secretVersion.create({
      data: {
        secretId: secret.id,
        encryptedData: secret.encryptedData,
        iv: secret.iv,
        encryptedItemKey: secret.encryptedItemKey,
      }
    });

    return this.prisma.secret.update({
      where: { id },
      data: {
        name: data.name,
        domain: data.domain,
        encryptedData: data.encryptedData,
        iv: data.iv,
        encryptedItemKey: data.encryptedItemKey, // If the key changed, though normally just data changes
      }
    });
  }

  async getSecretVersions(id: string, userId: string, organizationId: string) {
    const secret = await this.prisma.secret.findFirst({
      where: { id, organizationId, ownerId: userId }
    });
    if (!secret) throw new ForbiddenException('Only owner can view versions');

    return this.prisma.secretVersion.findMany({
      where: { secretId: id },
      orderBy: { createdAt: 'desc' }
    });
  }

  async restoreSecretVersion(id: string, versionId: string, userId: string, organizationId: string) {
    const secret = await this.prisma.secret.findFirst({
      where: { id, organizationId, ownerId: userId }
    });
    if (!secret) throw new ForbiddenException('Only owner can restore versions');

    const version = await this.prisma.secretVersion.findFirst({
      where: { id: versionId, secretId: id }
    });
    if (!version) throw new NotFoundException('Version not found');

    // Create a backup of current state before restore
    await this.prisma.secretVersion.create({
      data: {
        secretId: secret.id,
        encryptedData: secret.encryptedData,
        iv: secret.iv,
        encryptedItemKey: secret.encryptedItemKey,
      }
    });

    return this.prisma.secret.update({
      where: { id },
      data: {
        encryptedData: version.encryptedData,
        iv: version.iv,
        encryptedItemKey: version.encryptedItemKey,
      }
    });
  }

  async deleteSecret(id: string, organizationId: string) {
    const secret = await this.prisma.secret.findFirst({
      where: { id, organizationId }
    });
    if (!secret) throw new NotFoundException('Secret not found');

    return this.prisma.secret.delete({
      where: { id }
    });
  }
}
