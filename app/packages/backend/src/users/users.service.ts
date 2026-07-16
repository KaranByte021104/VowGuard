import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as argon2 from 'argon2';

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

  async enforceMfa(organizationId: string, enforce: boolean) {
    return this.prisma.organization.update({
      where: { id: organizationId },
      data: { mfaEnforced: enforce },
      select: { id: true, name: true, mfaEnforced: true }
    });
  }

  async updateProfile(userId: string, name: string, email: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { name, email },
      select: { id: true, name: true, email: true, avatarUrl: true, role: true }
    });
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: { id: true, name: true, email: true, avatarUrl: true, role: true }
    });
  }

  async changePassword(userId: string, currentPassword: string, newPasswordHash: string, newEncryptedPrivateKey: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    const isValid = await argon2.verify(user.loginPassword, currentPassword);
    if (!isValid) {
      throw new UnauthorizedException('Invalid current password');
    }

    const hashedNewPassword = await argon2.hash(newPasswordHash); // newPasswordHash from client is usually plain newPassword, but we hash it here to be safe

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        loginPassword: hashedNewPassword,
        encryptedPrivateKey: newEncryptedPrivateKey,
      }
    });

    return { success: true };
  }
}
