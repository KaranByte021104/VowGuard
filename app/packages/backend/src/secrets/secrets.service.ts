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
      }
    });
  }

  async getSecrets(organizationId: string) {
    // For Sprint 3, just return all secrets in the org since sharing/access control is Sprint 5
    // Only return secrets metadata to save bandwidth, unless requested otherwise.
    // Actually, we'll return everything so the frontend can decrypt them.
    return this.prisma.secret.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getSecret(id: string, organizationId: string) {
    const secret = await this.prisma.secret.findFirst({
      where: { id, organizationId }
    });
    if (!secret) throw new NotFoundException('Secret not found');
    return secret;
  }

  async updateSecret(id: string, userId: string, organizationId: string, data: any) {
    const secret = await this.prisma.secret.findFirst({
      where: { id, organizationId }
    });
    if (!secret) throw new NotFoundException('Secret not found');

    // Currently anyone in the org can update if no access control is enforced
    // For Sprint 3, owner or anyone can update. Let's just update.
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
