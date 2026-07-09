import { Injectable, NotFoundException, BadRequestException, ForbiddenException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AttachmentsService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  private readonly storageDir = path.join(process.cwd(), 'storage', 'attachments');

  async onModuleInit() {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  async uploadAttachment(secretId: string, userId: string, organizationId: string, file: any, iv: string, encryptedItemKey: string) {
    const secret = await this.prisma.secret.findFirst({
      where: { id: secretId, organizationId, ownerId: userId }
    });
    if (!secret) throw new ForbiddenException('Only owner can attach files');

    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('File size exceeds 10 MB limit');
    }

    const uuid = uuidv4();
    const filePath = path.join(this.storageDir, uuid);

    fs.writeFileSync(filePath, file.buffer);

    return this.prisma.fileAttachment.create({
      data: {
        secretId: secret.id,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        encryptedBlobPath: filePath,
        iv,
        encryptedItemKey,
      }
    });
  }

  async getAttachments(secretId: string, userId: string, organizationId: string) {
    const secret = await this.prisma.secret.findFirst({
      where: { id: secretId, organizationId, ownerId: userId }
    });
    if (!secret) throw new ForbiddenException('Only owner can view attachments');

    return this.prisma.fileAttachment.findMany({
      where: { secretId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async downloadAttachment(id: string, userId: string, organizationId: string) {
    const attachment = await this.prisma.fileAttachment.findFirst({
      where: { id },
      include: { secret: true }
    });
    if (!attachment) throw new NotFoundException('Attachment not found');

    if (attachment.secret.ownerId !== userId || attachment.secret.organizationId !== organizationId) {
      throw new ForbiddenException('Only owner can download attachments');
    }

    if (!fs.existsSync(attachment.encryptedBlobPath)) {
      throw new NotFoundException('Encrypted file not found on server');
    }

    const fileBuffer = fs.readFileSync(attachment.encryptedBlobPath);
    
    return {
      fileBuffer,
      attachment
    };
  }

  async deleteAttachment(id: string, userId: string, organizationId: string) {
    const attachment = await this.prisma.fileAttachment.findFirst({
      where: { id },
      include: { secret: true }
    });
    if (!attachment) throw new NotFoundException('Attachment not found');

    if (attachment.secret.ownerId !== userId || attachment.secret.organizationId !== organizationId) {
      throw new ForbiddenException('Only owner can delete attachments');
    }

    if (fs.existsSync(attachment.encryptedBlobPath)) {
      fs.unlinkSync(attachment.encryptedBlobPath);
    }

    await this.prisma.fileAttachment.delete({ where: { id } });
    return { success: true };
  }
}
