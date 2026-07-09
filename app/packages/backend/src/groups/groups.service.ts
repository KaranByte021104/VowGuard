import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GroupsService {
  constructor(private prisma: PrismaService) {}

  async createGroup(organizationId: string, name: string) {
    return this.prisma.userGroup.create({
      data: {
        organizationId,
        name
      }
    });
  }

  async getGroups(organizationId: string) {
    return this.prisma.userGroup.findMany({
      where: { organizationId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, email: true, publicKey: true }
            }
          }
        }
      }
    });
  }

  async getGroup(id: string, organizationId: string) {
    const group = await this.prisma.userGroup.findFirst({
      where: { id, organizationId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, email: true, publicKey: true }
            }
          }
        }
      }
    });
    if (!group) throw new NotFoundException('Group not found');
    return group;
  }

  async updateGroup(id: string, organizationId: string, name: string) {
    const group = await this.prisma.userGroup.findFirst({ where: { id, organizationId } });
    if (!group) throw new NotFoundException('Group not found');

    return this.prisma.userGroup.update({
      where: { id },
      data: { name }
    });
  }

  async deleteGroup(id: string, organizationId: string) {
    const group = await this.prisma.userGroup.findFirst({ where: { id, organizationId } });
    if (!group) throw new NotFoundException('Group not found');

    return this.prisma.userGroup.delete({
      where: { id }
    });
  }

  async addMember(groupId: string, emailOrId: string, organizationId: string) {
    const group = await this.prisma.userGroup.findFirst({ where: { id: groupId, organizationId } });
    if (!group) throw new NotFoundException('Group not found');

    const user = await this.prisma.user.findFirst({
      where: {
        organizationId,
        OR: [
          { id: emailOrId },
          { email: emailOrId }
        ]
      }
    });

    if (!user) throw new NotFoundException('User not found in your organization');

    return this.prisma.userGroupMember.create({
      data: {
        groupId,
        userId: user.id
      }
    });
  }

  async removeMember(groupId: string, userId: string, organizationId: string) {
    const group = await this.prisma.userGroup.findFirst({ where: { id: groupId, organizationId } });
    if (!group) throw new NotFoundException('Group not found');

    return this.prisma.userGroupMember.delete({
      where: {
        userId_groupId: {
          userId,
          groupId
        }
      }
    });
  }
}
