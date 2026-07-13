import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FoldersService {
  constructor(private prisma: PrismaService) {}

  async createFolder(userId: string, organizationId: string, data: { name: string; parentFolderId?: string }) {
    return this.prisma.folder.create({
      data: {
        name: data.name,
        ownerId: userId,
        organizationId,
        parentFolderId: data.parentFolderId,
      }
    });
  }

  async getFolders(organizationId: string, userId: string) {
    return this.prisma.folder.findMany({
      where: { 
        organizationId,
        OR: [
          { ownerId: userId },
          { secrets: { some: { secret: { shares: { some: { recipientUserId: userId } } } } } }
        ]
      },
      include: {
        secrets: {
          include: { 
            secret: {
              include: { shares: true }
            }
          }
        }
      }
    });
  }

  async updateFolder(id: string, organizationId: string, userId: string, data: { name?: string; parentFolderId?: string }) {
    const folder = await this.prisma.folder.findFirst({
      where: { id, organizationId, ownerId: userId }
    });
    if (!folder) throw new NotFoundException('Folder not found');

    return this.prisma.folder.update({
      where: { id },
      data: {
        name: data.name,
        parentFolderId: data.parentFolderId,
      }
    });
  }

  async deleteFolder(id: string, organizationId: string, userId: string) {
    const folder = await this.prisma.folder.findFirst({
      where: { id, organizationId, ownerId: userId }
    });
    if (!folder) throw new NotFoundException('Folder not found');

    return this.prisma.folder.delete({
      where: { id }
    });
  }

  async bulkAssignSecrets(folderId: string, secretIds: string[], organizationId: string, userId: string) {
    const folder = await this.prisma.folder.findFirst({
      where: { id: folderId, organizationId, ownerId: userId }
    });
    if (!folder) throw new NotFoundException('Folder not found');


    const data = secretIds.map(secretId => ({ folderId, secretId }));
    return this.prisma.folderSecret.createMany({
      data,
      skipDuplicates: true
    });
  }

  async removeSecretFromFolder(folderId: string, secretId: string, organizationId: string, userId: string) {
    const folder = await this.prisma.folder.findFirst({
      where: { id: folderId, organizationId, ownerId: userId }
    });
    if (!folder) throw new NotFoundException('Folder not found');

    return this.prisma.folderSecret.deleteMany({
      where: { folderId, secretId }
    });
  }

  async shareFolder(
    folderId: string,
    recipientUserId: string,
    permission: any,
    encryptedItemKeys: Record<string, string>,
    organizationId: string,
    userId: string
  ) {
    const folder = await this.prisma.folder.findFirst({
      where: { id: folderId, organizationId, ownerId: userId },
      include: { secrets: true }
    });
    if (!folder) throw new NotFoundException('Folder not found or you do not own it');

    // BR-5: Hard block — fetch full secret records and reject if any are personal
    const secretIds = folder.secrets.map(fs => fs.secretId);
    if (secretIds.length > 0) {
      const personalSecrets = await this.prisma.secret.findMany({
        where: { id: { in: secretIds }, isPersonal: true }
      });
      if (personalSecrets.length > 0) {
        throw new ForbiddenException(
          `This folder contains ${personalSecrets.length} personal secret(s) that cannot be shared. Remove them from the folder first.`
        );
      }
    }

    // Create a share for each secret in the folder that the user has provided a key for
    const sharesToCreate: any[] = [];
    for (const fs of folder.secrets) {
      if (encryptedItemKeys[fs.secretId]) {
        sharesToCreate.push({
          secretId: fs.secretId,
          recipientUserId,
          permission,
          encryptedItemKey: encryptedItemKeys[fs.secretId]
        });
      }
    }

    if (sharesToCreate.length > 0) {
      await this.prisma.secretShare.createMany({
        data: sharesToCreate,
        skipDuplicates: true
      });
    }

    return { success: true, sharesCreated: sharesToCreate.length };
  }

  async revokeFolderShare(folderId: string, recipientUserId: string, organizationId: string, userId: string) {
    const folder = await this.prisma.folder.findFirst({
      where: { id: folderId, organizationId, ownerId: userId },
      include: { secrets: true }
    });
    if (!folder) throw new NotFoundException('Folder not found or you do not own it');

    const secretIds = folder.secrets.map(fs => fs.secretId);
    if (secretIds.length === 0) return { success: true, sharesRevoked: 0 };

    const result = await this.prisma.secretShare.deleteMany({
      where: {
        secretId: { in: secretIds },
        recipientUserId
      }
    });

    return { success: true, sharesRevoked: result.count };
  }
}
