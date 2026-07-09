import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';

export const RequireControl = (action: string) => Reflect.metadata('controlAction', action);

@Injectable()
export class ControlsGuard implements CanActivate {
  constructor(private reflector: Reflector, private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredAction = this.reflector.get<string>('controlAction', context.getHandler());
    if (!requiredAction) return true; // Endpoint doesn't require a specific control check

    const req = context.switchToHttp().getRequest();
    const user = req.user;
    
    if (!user || !user.organizationId) {
      throw new ForbiddenException('User is not authenticated');
    }

    // Admins bypass controls
    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
      return true;
    }

    // Check if the control is globally enabled
    const control = await this.prisma.fineGrainedControl.findUnique({
      where: {
        organizationId_action: {
          organizationId: user.organizationId,
          action: requiredAction
        }
      },
      include: {
        exemptions: true
      }
    });

    if (control && control.isEnabled) {
      // It's blocked globally. Check for user exemption.
      const hasExemption = control.exemptions.some(e => e.userId === user.id);
      if (!hasExemption) {
        throw new ForbiddenException(`Your administrator has disabled ${requiredAction} for your account.`);
      }
    }

    return true;
  }
}
