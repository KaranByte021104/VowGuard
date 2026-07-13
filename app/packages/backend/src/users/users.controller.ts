import { Controller, Get, Put, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RoleGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
}
