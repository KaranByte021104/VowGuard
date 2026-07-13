import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getOrganizationUsers(organizationId: string) {
    return this.prisma.user.findMany({
      where: { organizationId },
      select: {
        id: true,
        email: true,
        publicKey: true,
        role: true,
        status: true
      }
    });
  }

  async updateRole(organizationId: string, targetUserId: string, newRole: string) {
    const targetUser = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser || targetUser.organizationId !== organizationId) {
      throw new BadRequestException('User not found in organization');
    }

    // BR-9: Block demoting or removing the organization's last Super Admin
    if (targetUser.role === 'SUPER_ADMIN' && newRole !== 'SUPER_ADMIN') {
      const superAdminCount = await this.prisma.user.count({
        where: {
          organizationId,
          role: 'SUPER_ADMIN'
        }
      });
      if (superAdminCount <= 1) {
        throw new BadRequestException('Cannot demote the last Super Admin of the organization.');
      }
    }

    return this.prisma.user.update({
      where: { id: targetUserId },
      data: { role: newRole as any }
    });
  }

  async removeUser(organizationId: string, targetUserId: string) {
    const targetUser = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser || targetUser.organizationId !== organizationId) {
      throw new BadRequestException('User not found in organization');
    }

    // BR-9: Block removing the organization's last Super Admin
    if (targetUser.role === 'SUPER_ADMIN') {
      const superAdminCount = await this.prisma.user.count({
        where: {
          organizationId,
          role: 'SUPER_ADMIN'
        }
      });
      if (superAdminCount <= 1) {
        throw new BadRequestException('Cannot remove the last Super Admin of the organization.');
      }
    }

    // Prisma's onDelete: SetNull on AuditLog relation handles keeping the log intact
    await this.prisma.user.delete({
      where: { id: targetUserId }
    });

    return { message: 'User removed successfully' };
  }
}
