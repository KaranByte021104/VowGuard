import { Injectable, CanActivate, ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { SharePermission } from '@prisma/client';

export const RequireSharePermission = (permission: SharePermission) => {
  return (target: any, key: string | symbol, descriptor: PropertyDescriptor) => {
    Reflector.createDecorator<SharePermission>().call(null, permission)(target, key, descriptor);
  };
};

@Injectable()
export class SharePermissionGuard implements CanActivate {
  constructor(private reflector: Reflector, private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.get<SharePermission>('requireSharePermission', context.getHandler());
    if (!requiredPermission) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    if (!user) throw new ForbiddenException('Not authenticated');

    // Attempt to extract secretId from params or body
    const secretId = request.params.id || request.params.secretId || request.body.secretId;
    if (!secretId) throw new NotFoundException('Secret ID not found in request');

    const secret = await this.prisma.secret.findFirst({
      where: { id: secretId, organizationId: user.organizationId }
    });

    if (!secret) throw new NotFoundException('Secret not found');
    
    if (secret.isPersonal && secret.ownerId !== user.id) {
        throw new ForbiddenException('You do not have access to this personal secret');
    }

    // Owner always has MANAGE
    if (secret.ownerId === user.id) return true;

    if (secret.isPersonal) {
        // If it's a personal secret and user is not the owner (checked above), block
        throw new ForbiddenException('Personal secrets cannot be accessed by others');
    }

    const shares = await this.prisma.secretShare.findMany({
      where: { secretId, recipientUserId: user.id }
    });

    if (shares.length === 0) {
      if (requiredPermission === 'VIEW' && secret.accessControlEnabled) {
        // Let the service handle the Access Request validation for VIEW operations
        return true;
      }
      throw new ForbiddenException('You do not have access to this secret');
    }

    const permissionWeights = {
      'ONE_CLICK_LOGIN_ONLY': 1,
      'VIEW': 2,
      'MODIFY': 3,
      'MANAGE': 4
    };

    const hasSufficientPermission = shares.some(
      (share) => permissionWeights[share.permission] >= permissionWeights[requiredPermission]
    );

    if (hasSufficientPermission) {
      return true;
    }

    throw new ForbiddenException(`Requires at least ${requiredPermission} permission`);
  }
}
