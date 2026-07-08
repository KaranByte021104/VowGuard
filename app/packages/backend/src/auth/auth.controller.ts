import { Controller, Post, Body, Res, Req, UnauthorizedException, Get, UseGuards } from '@nestjs/common';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Req() req: any) {
    return { user: req.user };
  }

  @Post('signup')
  async signup(@Body() body: any, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.signup(body);

    res.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return { user: result.user };
  }

  @Post('login')
  async login(@Body() body: any, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(body);
    
    if ('mfaRequired' in result && result.mfaRequired) {
      return result; // Return tempToken for MFA step
    }

    if ('accessToken' in result) {
      // Set secure cookies for session
      res.cookie('access_token', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000, // 15 mins
      });

      res.cookie('refresh_token', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      return { user: result.user };
    }
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies['refresh_token'];
    if (!refreshToken) throw new UnauthorizedException('No refresh token provided');

    // In a full implementation, this calls this.authService.refresh(refreshToken)
    // which handles the reuse detection, issues a new token pair, and revokes the old one.
    return { success: true };
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // Revoke all sessions if needed or just clear cookies
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    return { success: true };
  }

  @Post('reset-password/request')
  async requestPasswordReset(@Body() body: any) {
    // Generate token, send mock email
    console.log(`Mock Email: Password reset link for ${body.email}`);
    return { message: 'If the email exists, a reset link has been sent.' };
  }
}
