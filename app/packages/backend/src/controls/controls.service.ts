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

  async addExemption(organizationId: string, action: string, userId: string) {
    // Ensure the control record exists first
    const control = await this.prisma.fineGrainedControl.upsert({
      where: { organizationId_action: { organizationId, action } },
      update: {},
      create: { organizationId, action, isEnabled: true }
    });
    return this.prisma.fineGrainedControlExemption.upsert({
      where: { controlId_userId: { controlId: control.id, userId } },
      update: {},
      create: { controlId: control.id, userId }
    });
  }

  async removeExemption(organizationId: string, action: string, userId: string) {
    const control = await this.prisma.fineGrainedControl.findUnique({
      where: { organizationId_action: { organizationId, action } }
    });
    if (!control) return { success: false };
    await this.prisma.fineGrainedControlExemption.deleteMany({
      where: { controlId: control.id, userId }
    });
    return { success: true };
  }
}
