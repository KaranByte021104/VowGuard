import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PoliciesService {
  constructor(private prisma: PrismaService) {}

  async getPolicies(organizationId: string) {
    return this.prisma.passwordPolicy.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getActivePolicy(organizationId: string) {
    const policy = await this.prisma.passwordPolicy.findFirst({
      where: { organizationId, isDefault: true }
    });
    return policy || this.getDefaultPolicy(organizationId);
  }

  async createPolicy(organizationId: string, data: any) {
    if (data.isDefault) {
      await this.prisma.passwordPolicy.updateMany({
        where: { organizationId, isDefault: true },
        data: { isDefault: false }
      });
    }

    return this.prisma.passwordPolicy.create({
      data: {
        ...data,
        organizationId
      }
    });
  }

  async updatePolicy(id: string, organizationId: string, data: any) {
    const policy = await this.prisma.passwordPolicy.findFirst({
      where: { id, organizationId }
    });
    if (!policy) throw new NotFoundException('Policy not found');

    if (data.isDefault) {
      await this.prisma.passwordPolicy.updateMany({
        where: { organizationId, isDefault: true },
        data: { isDefault: false }
      });
    }

    return this.prisma.passwordPolicy.update({
      where: { id },
      data
    });
  }

  async deletePolicy(id: string, organizationId: string) {
    const policy = await this.prisma.passwordPolicy.findFirst({
      where: { id, organizationId }
    });
    if (!policy) throw new NotFoundException('Policy not found');

    if (policy.isDefault) {
      throw new Error('Cannot delete the default policy');
    }

    return this.prisma.passwordPolicy.delete({
      where: { id }
    });
  }

  private getDefaultPolicy(organizationId: string) {
    return {
      organizationId,
      name: 'System Default',
      isDefault: true,
      minLength: 12,
      maxLength: 128,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSymbols: true
    };
  }
}
