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
      where: { organizationId, ownerId: userId },
      include: {
        secrets: {
          include: { secret: true }
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

    const secrets = await this.prisma.secret.findMany({
      where: { id: { in: secretIds }, organizationId }
    });

    for (const secret of secrets) {
      if (secret.isPersonal) {
        throw new ForbiddenException(`Secret ${secret.id} is personal and cannot be added to a folder`);
      }
    }

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
}
