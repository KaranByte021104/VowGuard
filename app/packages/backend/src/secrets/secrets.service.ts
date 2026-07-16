import { Injectable, NotFoundException, ForbiddenException, HttpException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SecretsService {
  constructor(private prisma: PrismaService) {}

  async createSecret(userId: string, organizationId: string, data: any) {
    return this.prisma.secret.create({
      data: {
        ownerId: userId,
        organizationId,
        templateType: data.templateType || 'LOGIN',
        name: data.name,
        domain: data.domain,
        encryptedData: data.encryptedData,
        iv: data.iv,
        encryptedItemKey: data.encryptedItemKey,
        isPersonal: data.isPersonal || false,
        accessControlEnabled: data.accessControlEnabled || false,
        passwordScore: data.passwordScore || 0,
        isWeak: data.isWeak || false,
        isReused: data.isReused || false,
        containsUsername: data.containsUsername || false,
        isDictionaryWord: data.isDictionaryWord || false,
        isRecycled: data.isRecycled || false,
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
          { shares: { some: { recipientUserId: userId } } },
          { accessRequests: { some: { requesterId: userId, status: { in: ['APPROVED', 'PENDING'] } } } },
          { 
            accessControlEnabled: true,
            isPersonal: false,
            accessControlConfig: {
              excludedUsers: { none: { userId } },
              approvers: { some: {} }
            }
          }
        ]
      },
      orderBy: { createdAt: 'desc' },
      include: { 
        folders: true,
        shares: {
          where: { recipientUserId: userId }
        },
        accessRequests: {
          where: { requesterId: userId }
        }
      }
    });
  }

  async getSecret(id: string, userId: string, organizationId: string) {
    const secret = await this.prisma.secret.findFirst({
      where: { id, organizationId },
      include: {
        shares: {
          include: { recipientUser: true }
        },
        thirdPartyInvites: true,
        accessControlConfig: {
          include: { approvers: true }
        },
        accessRequests: {
          include: { requester: { select: { email: true } }, approvals: true }
        }
      }
    });
    if (!secret) throw new NotFoundException('Secret not found');
    
    // Filter access requests if user is not the owner
    if (secret.ownerId !== userId) {
      secret.accessRequests = secret.accessRequests.filter(r => r.requesterId === userId);
    }

    if (secret.accessControlEnabled && secret.ownerId !== userId) {
      console.log('Access Control check for secret:', secret.id, 'user:', userId);
      // Check if they have standing access (share)
      const hasShare = secret.shares.some(s => s.recipientUserId === userId);
      console.log('hasShare:', hasShare);
      if (!hasShare) {
        // Must have an approved request that is not expired
        const sortedRequests = [...secret.accessRequests].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const latestRequest = sortedRequests[0];
        
        if (!latestRequest || latestRequest.status === 'VOIDED') {
          throw new ForbiddenException('Access Control is enabled. You must request access.');
        }
        if (latestRequest.status === 'PENDING') {
          throw new ForbiddenException('Your access request is currently PENDING approval.');
        }
        if (latestRequest.status === 'DENIED') {
          throw new ForbiddenException('Your access request was DENIED.');
        }
        
        const approvedRequest = sortedRequests.find(r => r.status === 'APPROVED');
        if (!approvedRequest) {
          throw new ForbiddenException('Access Control is enabled. You must request access.');
        }
        if (approvedRequest.expiresAt && new Date() > approvedRequest.expiresAt) {
          console.log('Request expired. Throwing 410.');
          throw new HttpException('Access expired', 410);
        }
        console.log('Access granted via request!');
      }
    }

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
        passwordScore: data.passwordScore !== undefined ? data.passwordScore : undefined,
        isWeak: data.isWeak !== undefined ? data.isWeak : undefined,
        isReused: data.isReused !== undefined ? data.isReused : undefined,
        containsUsername: data.containsUsername !== undefined ? data.containsUsername : undefined,
        isDictionaryWord: data.isDictionaryWord !== undefined ? data.isDictionaryWord : undefined,
        isRecycled: data.isRecycled !== undefined ? data.isRecycled : undefined,
        isPersonal: data.isPersonal !== undefined ? data.isPersonal : undefined,
      }
    });
  }

  async getSecretVersions(id: string, userId: string, organizationId: string) {
    const secret = await this.prisma.secret.findFirst({
      where: { id, organizationId }
    });
    if (!secret) throw new NotFoundException('Secret not found');

    return this.prisma.secretVersion.findMany({
      where: { secretId: id },
      orderBy: { createdAt: 'desc' }
    });
  }

  async restoreSecretVersion(id: string, versionId: string, userId: string, organizationId: string) {
    const secret = await this.prisma.secret.findFirst({
      where: { id, organizationId }
    });
    if (!secret) throw new NotFoundException('Secret not found');

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
