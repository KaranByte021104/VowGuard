import { Module } from '@nestjs/common';
import { EmergencyAccessController } from './emergency-access.controller';
import { EmergencyAccessService } from './emergency-access.service';
import { PrismaModule } from '../prisma/prisma.module';
import { BullModule } from '@nestjs/bullmq';
import { EmergencyAccessProcessor } from './emergency-access.processor';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: 'emergency-access',
    }),
  ],
  controllers: [EmergencyAccessController],
  providers: [EmergencyAccessService, EmergencyAccessProcessor],
})
export class EmergencyAccessModule {}
