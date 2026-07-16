import { Injectable, UnauthorizedException, BadRequestException, HttpException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { MailerService } from '@nestjs-modules/mailer';

const failedLogins = new Map<string, { count: number; resetAt: number }>();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailerService: MailerService
  ) {}

  // Generates Access and Refresh Tokens with organizationId embedded in the JWT
  async generateTokens(userId: string, organizationId: string, existingFamilyId?: string) {
    const accessToken = this.jwtService.sign({ sub: userId, organizationId }, { expiresIn: '15m' });
    
    // Generate a secure random token for refresh
    const rawRefreshToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    const familyId = existingFamilyId || crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        userId,
        familyId,
        expiresAt,
      },
    });

    return { accessToken, refreshToken: rawRefreshToken, familyId };
  }

  async signup(data: any) {
    // Hash the login password
    const loginPasswordHash = await argon2.hash(data.loginPassword);

    let organization;
    let user;

    if (data.inviteToken) {
      // Find the pending invite
      const invite = await this.prisma.invitation.findUnique({
        where: { tokenHash: data.inviteToken }
      });
      if (!invite || invite.status !== 'PENDING' || invite.expiresAt < new Date()) {
        throw new BadRequestException('Invalid or expired invitation');
      }

      // Check if email matches invite
      if (invite.email.toLowerCase() !== data.email.toLowerCase()) {
        throw new BadRequestException('Email does not match the invitation');
      }

      // Create the user in the existing organization
      user = await this.prisma.user.create({
        data: {
          email: data.email,
          name: data.name,
          loginPassword: loginPasswordHash,
          publicKey: data.publicKey,
          encryptedPrivateKey: data.encryptedPrivateKey,
          role: invite.role,
          organizationId: invite.organizationId
        }
      });

      // Mark invite as ACCEPTED
      await this.prisma.invitation.update({
        where: { id: invite.id },
        data: { status: 'ACCEPTED' }
      });
    } else {
      // Create the Organization and User (Original flow)
      organization = await this.prisma.organization.create({
        data: {
          name: data.organizationName,
          type: data.type || 'TEAMS',
          users: {
            create: {
              email: data.email,
              name: data.name,
              loginPassword: loginPasswordHash,
              publicKey: data.publicKey,
              encryptedPrivateKey: data.encryptedPrivateKey,
              role: 'SUPER_ADMIN',
            }
          }
        },
        include: {
          users: true
        }
      });
      user = organization.users[0];
    }

    const tokens = await this.generateTokens(user.id, user.organizationId);

    return {
      user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, role: user.role, encryptedPrivateKey: user.encryptedPrivateKey, publicKey: user.publicKey, mfaEnabled: user.mfaType && user.mfaType !== 'NONE' },
      ...tokens,
    };
  }

  async login(data: any) {
    const emailKey = data.email.toLowerCase();
    const now = Date.now();
    
    if (failedLogins.has(emailKey)) {
      const record = failedLogins.get(emailKey)!;
      if (now > record.resetAt) {
        failedLogins.delete(emailKey);
      } else if (record.count >= MAX_FAILED_ATTEMPTS) {
        throw new HttpException('Too Many Requests', 429);
      }
    }

    const handleFailedLogin = () => {
      const record = failedLogins.get(emailKey) || { count: 0, resetAt: now + LOCKOUT_MS };
      record.count++;
      record.resetAt = now + LOCKOUT_MS;
      failedLogins.set(emailKey, record);
      throw new UnauthorizedException('Invalid credentials');
    };

    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
      include: { organization: true }
    });

    if (!user) return handleFailedLogin();

    const isValid = await argon2.verify(user.loginPassword, data.loginPassword);
    if (!isValid) return handleFailedLogin();

    // Successful login - clear any failed attempts
    failedLogins.delete(emailKey);

    if (user.organization.mfaEnforced && user.mfaType === 'NONE') {
      throw new UnauthorizedException('MFA Setup Required by Organization');
    }

    if (user.mfaType !== 'NONE') {
      // Need MFA verification
      const tempToken = this.jwtService.sign({ sub: user.id, isMfaTemp: true }, { expiresIn: '5m' });
      return { mfaRequired: true, tempToken };
    }

    const tokens = await this.generateTokens(user.id, user.organizationId);
    
    return {
      user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, role: user.role, encryptedPrivateKey: user.encryptedPrivateKey, publicKey: user.publicKey, mfaEnabled: user.mfaType && user.mfaType !== 'NONE' },
      ...tokens,
    };
  }

  async refresh(oldRefreshToken: string) {
    const tokenHash = crypto.createHash('sha256').update(oldRefreshToken).digest('hex');
    
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { tokenHash }
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (tokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // Reuse detection
    if (tokenRecord.isRevoked) {
      // Token theft detected! Revoke entire family.
      await this.prisma.refreshToken.updateMany({
        where: { familyId: tokenRecord.familyId },
        data: { isRevoked: true }
      });
      throw new UnauthorizedException('Security alert: Token reuse detected. All sessions revoked.');
    }

    // Revoke the old token
    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { isRevoked: true }
    });

    // Generate new token pair in the same family
    const user = await this.prisma.user.findUnique({ where: { id: tokenRecord.userId }, select: { organizationId: true } });
    return this.generateTokens(tokenRecord.userId, user?.organizationId || '', tokenRecord.familyId);
  }

  async revokeAllUserSessions(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { isRevoked: true },
    });
  }

  async generateTotpSecret(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const secret = speakeasy.generateSecret({ name: `VowGuard (${user.email})` });
    const qrCode = await QRCode.toDataURL(secret.otpauth_url!);

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: secret.base32 } // Stored temporarily until verified
    });

    return { secret: secret.base32, qrCode };
  }

  async verifyTotpSetup(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.mfaSecret) throw new BadRequestException('MFA setup not initiated');

      const isValid = speakeasy.totp.verify({ token, secret: user.mfaSecret, encoding: 'base32', window: 2 });
    if (!isValid) throw new UnauthorizedException('Invalid verification code');

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaType: 'TOTP' }
    });

    return { success: true };
  }

  async loginWithMfa(tempToken: string, token: string) {
    try {
      const decoded = this.jwtService.verify(tempToken) as any;
      if (!decoded.isMfaTemp) throw new Error();

      const user = await this.prisma.user.findUnique({ where: { id: decoded.sub } });
      if (!user || !user.mfaSecret) throw new Error();

        const isValid = speakeasy.totp.verify({ token, secret: user.mfaSecret, encoding: 'base32', window: 2 });
      if (!isValid) throw new UnauthorizedException('Invalid MFA token');

      const tokens = await this.generateTokens(user.id, user.organizationId);
      return {
        ...tokens,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          role: user.role,
          organizationId: user.organizationId,
          publicKey: user.publicKey,
          encryptedPrivateKey: user.encryptedPrivateKey,
          mfaEnabled: user.mfaType && user.mfaType !== 'NONE'
        }
      };
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('Invalid or expired MFA session');
    }
  }

  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return { message: 'If the email exists, a reset link has been sent.' }; // Do not leak email existence

    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: hash, passwordResetExpires: expires }
    });

    try {
      await this.mailerService.sendMail({
        to: user.email,
        subject: 'Password Reset Request',
        text: `Use this token to reset your password: ${token}\nThis token expires in 15 minutes.`,
      });
    } catch (e) {
      console.error('Failed to send email via SMTP, logging token for dev:', token);
    }

    return { message: 'If the email exists, a reset link has been sent.' };
  }

  async resetPassword(data: any) {
    const hash = crypto.createHash('sha256').update(data.token).digest('hex');
    
    const user = await this.prisma.user.findFirst({
      where: {
        email: data.email,
        passwordResetToken: hash,
        passwordResetExpires: { gt: new Date() }
      }
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const loginPasswordHash = await argon2.hash(data.newPassword);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        loginPassword: loginPasswordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      }
    });

    // Invalidate all existing sessions
    await this.revokeAllUserSessions(user.id);

    return { success: true };
  }
}
