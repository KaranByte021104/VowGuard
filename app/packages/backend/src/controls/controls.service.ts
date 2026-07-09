import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ControlsService {
  constructor(private prisma: PrismaService) {}

  async getControls(organizationId: string) {
    const controls = await this.prisma.fineGrainedControl.findMany({
      where: { organizationId },
      include: { exemptions: true }
    });
    
    // Ensure default controls exist
    const defaultActions = ['EXPORT_SECRETS', 'THIRD_PARTY_SHARING', 'OFFLINE_ACCESS'];
    const result: any[] = [];
    
    for (const action of defaultActions) {
      const existing = controls.find(c => c.action === action);
      if (existing) {
        result.push(existing);
      } else {
        result.push({ action, isEnabled: false, exemptions: [] });
      }
    }
    
    return result;
  }

  async toggleControl(organizationId: string, action: string, isEnabled: boolean) {
    return this.prisma.fineGrainedControl.upsert({
      where: {
        organizationId_action: { organizationId, action }
      },
      update: { isEnabled },
      create: { organizationId, action, isEnabled }
    });
  }
}
