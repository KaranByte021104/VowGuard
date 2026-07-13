import { Controller, Post, Get, Body, Param, UseGuards, Request, BadRequestException, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RoleGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { MailerService } from '@nestjs-modules/mailer';
import * as crypto from 'crypto';

@Controller('invitations')
export class InvitationsController {
  private readonly logger = new Logger(InvitationsController.name);

  constructor(
    private prisma: PrismaService,
    private mailerService: MailerService
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  async createInvite(@Request() req, @Body('email') email: string) {
    if (!email) throw new BadRequestException('Email is required');

    // To prevent user enumeration, we always return the same success message
    const successResponse = { message: 'If the email is not already registered, an invitation has been sent successfully.' };

    try {
      // Check if user already exists
      const existingUser = await this.prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return successResponse; // Silently ignore to prevent enumeration
      }

      // Check if an invite already exists
      const existingInvite = await this.prisma.invitation.findUnique({ where: { email } });
      if (existingInvite) {
        // We could resend, but for this implementation we will just delete and recreate to get a fresh token
        await this.prisma.invitation.delete({ where: { email } });
      }

      const token = crypto.randomBytes(32).toString('hex');

      // Create the invite
      const invite = await this.prisma.invitation.create({
        data: {
          email,
          organizationId: req.user.organizationId,
          tokenHash: token,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        }
      });

      const inviteLink = `http://localhost:5173/signup?invite=${token}`;
      
      // Attempt to send email asynchronously (so we don't block the response)
      this.mailerService.sendMail({
        to: email,
        subject: 'You have been invited to join SecureVault',
        text: `You have been invited to join an organization on SecureVault. Please click the link to create your Master Password and join: ${inviteLink}`,
        html: `<p>You have been invited to join an organization on SecureVault.</p><p><a href="${inviteLink}">Click here to join</a></p>`
      }).catch(err => {
        this.logger.error(`Failed to send invite email to ${email}: ${err.message}`);
      });

      return successResponse;
    } catch (error) {
      this.logger.error(`Error processing invite for ${email}: ${error.message}`);
      // Still return the generic success response so errors don't leak state
      return successResponse;
    }
  }

  @Get(':token')
  async verifyInvite(@Param('token') token: string) {
    const invite = await this.prisma.invitation.findUnique({
      where: { tokenHash: token },
      include: { organization: true }
    });

    if (!invite) throw new BadRequestException('Invalid or expired invitation');
    if (invite.status !== 'PENDING') throw new BadRequestException('Invitation has already been used or revoked');
    if (invite.expiresAt < new Date()) throw new BadRequestException('Invitation has expired');

    return {
      email: invite.email,
      organizationName: invite.organization.name,
      role: invite.role
    };
  }
}
