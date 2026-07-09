import { Module } from '@nestjs/common';
import { BackupService } from './backup.service';
import { BackupController } from './backup.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { BackupProcessor } from './backup.processor';
import { BackupScheduler } from './backup.scheduler';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: 'backupQueue',
    }),
  ],
  controllers: [BackupController],
  providers: [BackupService, BackupProcessor, BackupScheduler],
})
export class BackupModule {}
