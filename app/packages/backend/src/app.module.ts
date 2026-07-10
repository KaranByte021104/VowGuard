import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
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
import { SsoModule } from './sso/sso.module';
import { BackupModule } from './backup/backup.module';
import { ScheduleModule } from '@nestjs/schedule';
import { AuditInterceptor } from './audit/audit.interceptor';
import { ReportsModule } from './reports/reports.module';
import { AlertsModule } from './alerts/alerts.module';
import { ControlsModule } from './controls/controls.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100, // Global limit: 100 requests per minute
    }]),
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
    SsoModule,
    BackupModule,
    ReportsModule,
    AlertsModule,
    ControlsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
