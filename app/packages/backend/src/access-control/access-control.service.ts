import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class AccessControlService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue('access-control') private accessQueue: Queue,
  ) {}

  async enableAccessControl(secretId: string, userId: string, organizationId: string, data: any) {
    const secret = await this.prisma.secret.findFirst({
      where: { id: secretId, organizationId }
    });

    if (!secret) throw new NotFoundException('Secret not found');
    if (secret.ownerId !== userId) throw new ForbiddenException('Only the owner can enable Access Control');
    if (secret.isPersonal) throw new ForbiddenException('Personal secrets cannot be placed under Access Control');

    // Remove existing config if any
    await this.prisma.accessControlConfig.deleteMany({ where: { secretId } });

    const config = await this.prisma.accessControlConfig.create({
      data: {
        secretId,
        minimumApproverCount: data.minimumApproverCount || 1,
        autoVoidHours: data.autoVoidHours || 24,
        grantDurationMinutes: data.grantDurationMinutes || 60,
        automaticApprovalRule: data.automaticApprovalRule || null,
        approvers: {
          create: (data.approvers || []).map(id => ({ userId: id }))
        },
        excludedUsers: {
          create: (data.excludedUsers || []).map(id => ({ userId: id }))
        }
      }
    });

    await this.prisma.secret.update({
      where: { id: secretId },
      data: { accessControlEnabled: true }
    });

    return config;
  }

  async createRequest(secretId: string, userId: string, organizationId: string, data: any) {
    const secret = await this.prisma.secret.findFirst({
      where: { id: secretId, organizationId },
      include: { accessControlConfig: { include: { excludedUsers: true } } }
    });

    if (!secret) throw new NotFoundException('Secret not found');
    if (!secret.accessControlEnabled || !secret.accessControlConfig) {
      throw new BadRequestException('Access Control is not enabled for this secret');
    }

    const isExcluded = secret.accessControlConfig.excludedUsers.some(eu => eu.userId === userId);
    if (isExcluded) throw new ForbiddenException('You are excluded from requesting access to this secret');

    let isAutoApproved = false;
    if (secret.accessControlConfig.automaticApprovalRule === 'BUSINESS_HOURS') {
      const now = new Date();
      const day = now.getDay();
      const hour = now.getHours();
      // M-F, 9am - 5pm
      if (day >= 1 && day <= 5 && hour >= 9 && hour < 17) {
        isAutoApproved = true;
      }
    }

    const status = isAutoApproved ? 'APPROVED' : 'PENDING';
    const expiresAt = isAutoApproved ? new Date(Date.now() + secret.accessControlConfig.grantDurationMinutes * 60000) : null;
    const voidsAt = !isAutoApproved ? new Date(Date.now() + secret.accessControlConfig.autoVoidHours * 3600000) : null;

    const request = await this.prisma.accessRequest.create({
      data: {
        secretId,
        requesterId: userId,
        reason: data.reason,
        timing: data.timing || 'IMMEDIATE',
        status,
        expiresAt,
        voidsAt
      }
    });

    if (isAutoApproved) {
      await this.accessQueue.add('auto-expire', { requestId: request.id }, {
        delay: secret.accessControlConfig.grantDurationMinutes * 60000,
        jobId: `expire-${request.id}`
      });
    } else {
      await this.accessQueue.add('auto-void', { requestId: request.id }, {
        delay: secret.accessControlConfig.autoVoidHours * 3600000,
        jobId: `void-${request.id}`
      });
    }

    return request;
  }

  async getRequests(secretId: string, userId: string, organizationId: string) {
    // Basic check
    return this.prisma.accessRequest.findMany({
      where: { secretId, secret: { organizationId } },
      include: { requester: { select: { email: true } }, approvals: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getPendingRequestsForApprover(userId: string, organizationId: string) {
    return this.prisma.accessRequest.findMany({
      where: {
        status: 'PENDING',
        approvals: { none: { approverId: userId } },
        secret: {
          organizationId,
          accessControlConfig: {
            approvers: { some: { userId } }
          }
        }
      },
      include: { secret: { select: { name: true, encryptedItemKey: true } }, requester: { select: { email: true, publicKey: true } } }
    });
  }

  async approveRequest(requestId: string, userId: string, organizationId: string, encryptedItemKey?: string) {
    const request = await this.prisma.accessRequest.findFirst({
      where: { id: requestId, secret: { organizationId } },
      include: { 
        secret: { include: { accessControlConfig: { include: { approvers: true } } } },
        approvals: true 
      }
    });

    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== 'PENDING') return { message: 'Request is no longer pending' };

    const isApprover = request.secret.accessControlConfig!.approvers.some(a => a.userId === userId);
    if (!isApprover) throw new ForbiddenException('You are not an approver for this secret');

    const alreadyApproved = request.approvals.some(a => a.approverId === userId);
    if (alreadyApproved) return { message: 'Already approved' };

    await this.prisma.accessApproval.create({
      data: {
        requestId,
        approverId: userId,
        decision: 'APPROVED'
      }
    });

    const newApprovalCount = request.approvals.filter(a => a.decision === 'APPROVED').length + 1;
    const requiredCount = request.secret.accessControlConfig!.minimumApproverCount;

    if (newApprovalCount >= requiredCount) {
      if (!encryptedItemKey) {
        throw new BadRequestException('Encrypted item key must be provided for final approval');
      }

      // Threshold met
      const expiresAt = new Date(Date.now() + request.secret.accessControlConfig!.grantDurationMinutes * 60000);
      await this.prisma.accessRequest.update({
        where: { id: requestId },
        data: { status: 'APPROVED', expiresAt, encryptedItemKey }
      });

      await this.accessQueue.add('auto-expire', { requestId: request.id }, {
        delay: request.secret.accessControlConfig!.grantDurationMinutes * 60000,
        jobId: `expire-${request.id}`
      });
      return { message: 'Request fully approved and access granted' };
    }

    return { message: 'Approval recorded. Waiting for more approvers.' };
  }

  async denyRequest(requestId: string, userId: string, organizationId: string) {
    const request = await this.prisma.accessRequest.findFirst({
      where: { id: requestId, secret: { organizationId } },
      include: { secret: { include: { accessControlConfig: { include: { approvers: true } } } } }
    });

    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== 'PENDING') throw new BadRequestException('Request is no longer pending');

    const isApprover = request.secret.accessControlConfig!.approvers.some(a => a.userId === userId);
    if (!isApprover) throw new ForbiddenException('You are not an approver for this secret');

    await this.prisma.accessApproval.create({
      data: {
        requestId,
        approverId: userId,
        decision: 'DENIED'
      }
    });

    await this.prisma.accessRequest.update({
      where: { id: requestId },
      data: { status: 'DENIED' }
    });

    return { message: 'Request denied' };
  }
}
