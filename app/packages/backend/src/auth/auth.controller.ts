import { Controller, Post, Body, Res, Req, UnauthorizedException, Get, UseGuards, Request } from '@nestjs/common';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Response, Request as ExpressRequest } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
@UseGuards(ThrottlerGuard)
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
      secure: true,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return { user: result.user };
  }

  @SkipThrottle()
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
        secure: true,
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000, // 15 mins
      });

      res.cookie('refresh_token', result.refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      return { user: result.user };
    }
  }

  @Post('refresh')
  async refresh(@Req() req: ExpressRequest, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies['refresh_token'];
    if (!refreshToken) throw new UnauthorizedException('No refresh token provided');

    const result = await this.authService.refresh(refreshToken);

    res.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return { success: true };
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // Revoke all sessions if needed or just clear cookies
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    return { success: true };
  }

  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  @Post('reset-password/request')
  async requestPasswordReset(@Body() body: any) {
    return this.authService.requestPasswordReset(body.email);
  }

  @Post('reset-password')
  async resetPassword(@Body() body: any) {
    return this.authService.resetPassword(body);
  }

  @Post('mfa/setup')
  @UseGuards(JwtAuthGuard)
  async setupMfa(@Request() req: any) {
    return this.authService.generateTotpSecret(req.user.id);
  }

  @Post('mfa/verify')
  @UseGuards(JwtAuthGuard)
  async verifyMfa(@Request() req: any, @Body() body: { token: string }) {
    return this.authService.verifyTotpSetup(req.user.id, body.token);
  }

  // TRD §12: 5 attempts per 10 minutes for MFA verification
  @Throttle({ default: { limit: 5, ttl: 600000 } })
  @Post('login/mfa')
  async loginMfa(@Body() body: { tempToken: string, token: string }, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.loginWithMfa(body.tempToken, body.token);

    res.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return {
      success: true,
      user: result.user,
    };
  }
}
