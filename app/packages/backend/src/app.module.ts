import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { SecretsModule } from './secrets/secrets.module';
import { SharingModule } from './sharing/sharing.module';
import { AdminModule } from './admin/admin.module';
import { ReportingModule } from './reporting/reporting.module';
import { PrismaModule } from './prisma/prisma.module';
import { PoliciesModule } from './policies/policies.module';
import { FoldersModule } from './folders/folders.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { GroupsModule } from './groups/groups.module';
import { UsersModule } from './users/users.module';
import { SharesModule } from './shares/shares.module';
import { AccessControlModule } from './access-control/access-control.module';
import { EmergencyAccessModule } from './emergency-access/emergency-access.module';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    UsersModule,
    SecretsModule,
    SharingModule,
    AdminModule,
    ReportingModule,
    PrismaModule,
    PoliciesModule,
    FoldersModule,
    AttachmentsModule,
    GroupsModule,
    SharesModule,
    AccessControlModule,
    EmergencyAccessModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
