import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AccessControlController } from './access-control.controller';
import { AccessControlService } from './access-control.service';
import { AccessControlProcessor } from './access-control.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'access-control',
    }),
  ],
  controllers: [AccessControlController],
  providers: [AccessControlService, AccessControlProcessor],
  exports: [AccessControlService],
})
export class AccessControlModule {}
