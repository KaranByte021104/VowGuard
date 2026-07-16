import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          return request?.cookies?.access_token;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'super-secret-sprint-2',
    });
  }

  async validate(payload: any) {
    if (payload.mfaPending) {
      throw new UnauthorizedException('MFA verification pending');
    }
    
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    return { 
      id: user.id, 
      email: user.email, 
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role, 
      publicKey: user.publicKey,
      organizationId: user.organizationId,
      mfaEnabled: user.mfaType && user.mfaType !== 'NONE'
    };
  }
}
