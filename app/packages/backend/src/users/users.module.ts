import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { InvitationsController } from './invitations.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [UsersController, InvitationsController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
