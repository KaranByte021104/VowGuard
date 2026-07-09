import { Injectable, NotFoundException, ForbiddenException, HttpException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class EmergencyAccessService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue('emergency-access') private emergencyQueue: Queue,
  ) {}

  async designateContact(ownerId: string, contactId: string, sessionValidityHours: number, waitingPeriodHours: number, encryptedPrivateKey: string) {
    if (ownerId === contactId) throw new ForbiddenException("Cannot designate yourself");

    return this.prisma.emergencyAccessGrant.upsert({
      where: { ownerId_contactId: { ownerId, contactId } },
      create: {
        ownerId,
        contactId,
        sessionValidityHours,
        waitingPeriodHours,
        encryptedPrivateKey,
        status: 'INACTIVE'
      },
      update: {
        sessionValidityHours,
        waitingPeriodHours,
        encryptedPrivateKey,
        status: 'INACTIVE', // Reset status if they were previously pending/active
        waitingPeriodUntil: null,
        sessionExpiresAt: null,
      }
    });
  }

  async getDesignatedContacts(ownerId: string) {
    return this.prisma.emergencyAccessGrant.findMany({
      where: { ownerId },
      include: { contact: { select: { email: true, id: true } } },
      orderBy: { createdAt: 'desc' }
    });
  }

  async removeContact(ownerId: string, grantId: string) {
    const grant = await this.prisma.emergencyAccessGrant.findUnique({ where: { id: grantId } });
    if (!grant || grant.ownerId !== ownerId) throw new NotFoundException();
    return this.prisma.emergencyAccessGrant.delete({ where: { id: grantId } });
  }

  async getReceivedGrants(contactId: string) {
    return this.prisma.emergencyAccessGrant.findMany({
      where: { contactId },
      include: { owner: { select: { email: true, id: true } } },
      orderBy: { createdAt: 'desc' }
    });
  }

  async triggerGrant(contactId: string, grantId: string) {
    const grant = await this.prisma.emergencyAccessGrant.findUnique({ where: { id: grantId } });
    if (!grant || grant.contactId !== contactId) throw new NotFoundException();
    if (grant.status !== 'INACTIVE' && grant.status !== 'EXPIRED' && grant.status !== 'DENIED') {
      throw new HttpException('Grant is already pending or active', 400);
    }

    const waitingPeriodUntil = new Date(Date.now() + grant.waitingPeriodHours * 60 * 60 * 1000);

    const updated = await this.prisma.emergencyAccessGrant.update({
      where: { id: grantId },
      data: {
        status: 'PENDING',
        waitingPeriodUntil,
      }
    });

    // Enqueue activation job
    await this.emergencyQueue.add(
      'emergency-grant-activation',
      { grantId },
      { delay: grant.waitingPeriodHours * 60 * 60 * 1000, jobId: `activate-${grantId}-${Date.now()}` }
    );

    console.log(`[Emergency Access] Alert sent to Owner ${grant.ownerId}: ${contactId} triggered emergency access.`);
    
    return updated;
  }

  async denyGrant(ownerId: string, grantId: string) {
    const grant = await this.prisma.emergencyAccessGrant.findUnique({ where: { id: grantId } });
    if (!grant || grant.ownerId !== ownerId) throw new NotFoundException();
    if (grant.status !== 'PENDING') throw new HttpException('Can only deny pending requests', 400);

    return this.prisma.emergencyAccessGrant.update({
      where: { id: grantId },
      data: {
        status: 'DENIED',
        waitingPeriodUntil: null,
      }
    });
  }

  async getEmergencyVault(contactId: string, ownerId: string) {
    // Verify there is an ACTIVE grant
    const grant = await this.prisma.emergencyAccessGrant.findFirst({
      where: { ownerId, contactId },
      orderBy: { createdAt: 'desc' }
    });

    if (!grant) throw new ForbiddenException('No emergency access grant found');
    
    // Check if it's expired
    if (grant.status === 'EXPIRED') {
      throw new HttpException('Access expired', 410);
    }
    
    if (grant.status !== 'ACTIVE') {
      throw new ForbiddenException('Emergency access is not active');
    }

    if (grant.sessionExpiresAt && new Date() > grant.sessionExpiresAt) {
      // It should be marked EXPIRED by the background job, but just in case
      await this.prisma.emergencyAccessGrant.update({ where: { id: grant.id }, data: { status: 'EXPIRED' } });
      throw new HttpException('Access expired', 410);
    }

    // Return the owner's secrets
    console.log(`[EmergencyVault] Fetching secrets for ownerId: ${ownerId}, contactId: ${contactId}`);
    const secrets = await this.prisma.secret.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' }
    });
    console.log(`[EmergencyVault] Found ${secrets.length} secrets.`);
    return secrets;
  }
}
