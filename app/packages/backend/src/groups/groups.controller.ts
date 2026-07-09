import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('groups')
@UseGuards(JwtAuthGuard)
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  createGroup(@Request() req, @Body() body: { name: string }) {
    return this.groupsService.createGroup(req.user.organizationId, body.name);
  }

  @Get()
  getGroups(@Request() req) {
    return this.groupsService.getGroups(req.user.organizationId);
  }

  @Get(':id')
  getGroup(@Request() req, @Param('id') id: string) {
    return this.groupsService.getGroup(id, req.user.organizationId);
  }

  @Put(':id')
  updateGroup(@Request() req, @Param('id') id: string, @Body() body: { name: string }) {
    return this.groupsService.updateGroup(id, req.user.organizationId, body.name);
  }

  @Delete(':id')
  deleteGroup(@Request() req, @Param('id') id: string) {
    return this.groupsService.deleteGroup(id, req.user.organizationId);
  }

  @Post(':id/members')
  addMember(@Request() req, @Param('id') id: string, @Body() body: { userId: string }) {
    return this.groupsService.addMember(id, body.userId, req.user.organizationId);
  }

  @Delete(':id/members/:userId')
  removeMember(@Request() req, @Param('id') id: string, @Param('userId') userId: string) {
    return this.groupsService.removeMember(id, userId, req.user.organizationId);
  }
}
