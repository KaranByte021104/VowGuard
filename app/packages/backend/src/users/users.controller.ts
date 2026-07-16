import { Controller, Get, Put, Delete, Patch, Param, Body, UseGuards, Request, Post, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RoleGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('profile')
  updateProfile(@Request() req, @Body() body: { name: string; email: string }) {
    return this.usersService.updateProfile(req.user.id, body.name, body.email);
  }

  @Post('profile-picture')
  @UseInterceptors(FileInterceptor('file', {
    dest: './uploads',
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  }))
  uploadProfilePicture(@Request() req, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    const avatarUrl = `http://localhost:3000/uploads/${file.filename}`;
    return this.usersService.updateAvatar(req.user.id, avatarUrl);
  }

  @Post('change-password')
  changePassword(@Request() req, @Body() body: any) {
    return this.usersService.changePassword(
      req.user.id,
      body.currentPassword,
      body.newPassword,
      body.newEncryptedPrivateKey
    );
  }

  @Get()
  getOrganizationUsers(@Request() req) {
    return this.usersService.getOrganizationUsers(req.user.organizationId);
  }

  @Put(':id/role')
  @UseGuards(RoleGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  updateUserRole(@Request() req, @Param('id') id: string, @Body('role') role: string) {
    return this.usersService.updateRole(req.user.organizationId, id, role);
  }

  @Delete(':id')
  @UseGuards(RoleGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  removeUser(@Request() req, @Param('id') id: string) {
    return this.usersService.removeUser(req.user.organizationId, id);
  }

  /** Toggle org-wide MFA enforcement. SUPER_ADMIN only. */
  @Patch('organization/enforce-mfa')
  @UseGuards(RoleGuard)
  @Roles('SUPER_ADMIN')
  enforceMfa(@Request() req, @Body('enforce') enforce: boolean) {
    return this.usersService.enforceMfa(req.user.organizationId, enforce);
  }
}
