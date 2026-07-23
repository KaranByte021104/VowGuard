import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { google } from 'googleapis';
import * as crypto from 'crypto';

@Injectable()
export class BackupService {
  private readonly oauth2Client;
  private readonly encryptionKey: Buffer;

  constructor(private prisma: PrismaService) {
    const clientId = process.env.GOOGLE_CLIENT_ID || 'dummy_client_id';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || 'dummy_client_secret';
    const redirectUri = process.env.WEB_URL ? `${process.env.WEB_URL}/backup/callback/google` : 'http://localhost:5173/backup/callback/google';

    this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    
    // BACKUP_ENCRYPTION_KEY must be exactly 32 bytes for AES-256
    const key = process.env.BACKUP_ENCRYPTION_KEY || 'default_backup_encryption_key_32';
    this.encryptionKey = Buffer.from(key.padEnd(32, '0').slice(0, 32), 'utf8');
  }

  private encryptToken(token: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    let encrypted = cipher.update(token, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag().toString('base64');
    return `${iv.toString('base64')}:${authTag}:${encrypted}`;
  }

  public decryptToken(encryptedToken: string): string {
    const parts = encryptedToken.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted token format');
    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    const encrypted = parts[2];
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  async getConfig(userId: string) {
    return this.prisma.backupConfig.findUnique({ where: { userId } });
  }

  async updateConfig(userId: string, frequency: 'DAILY' | 'WEEKLY', ownedOnly: boolean) {
    const config = await this.prisma.backupConfig.findUnique({ where: { userId } });
    if (!config) throw new NotFoundException('Backup config not found');
    
    let nextScheduledRun = config.nextScheduledRun;
    
    if (frequency !== config.frequency && config.nextScheduledRun) {
      const now = new Date();
      if (frequency === 'DAILY') {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (config.nextScheduledRun > tomorrow) {
          nextScheduledRun = tomorrow;
        }
      }
    }

    return this.prisma.backupConfig.update({
      where: { userId },
      data: { frequency, ownedOnly, nextScheduledRun }
    });
  }

  async getGoogleAuthUrl(userId: string) {
    // We pass userId in state to correlate later if needed, but the frontend intercepts it
    const scopes = ['https://www.googleapis.com/auth/drive.file'];
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent' // Force to get refresh_token
    });
  }

  async handleGoogleCallback(userId: string, code: string) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      if (!tokens.refresh_token) {
        throw new BadRequestException('No refresh token received. Try removing access from Google Account and try again.');
      }
      
      const encryptedToken = this.encryptToken(tokens.refresh_token);
      
      return this.prisma.backupConfig.upsert({
        where: { userId },
        update: {
          provider: 'GOOGLE_DRIVE',
          encryptedToken,
          frequency: 'WEEKLY',
          ownedOnly: true
        },
        create: {
          userId,
          provider: 'GOOGLE_DRIVE',
          encryptedToken,
          frequency: 'WEEKLY',
          ownedOnly: true
        }
      });
    } catch (error) {
      console.error(error);
      throw new BadRequestException('Failed to exchange Google OAuth code');
    }
  }

  async disconnect(userId: string) {
    await this.prisma.backupConfig.delete({ where: { userId } }).catch(() => {});
    return { success: true };
  }

  async listFiles(userId: string) {
    const config = await this.getConfig(userId);
    if (!config || config.provider !== 'GOOGLE_DRIVE') {
      throw new BadRequestException('Google Drive backup not configured');
    }

    const refreshToken = this.decryptToken(config.encryptedToken);
    const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
    auth.setCredentials({ refresh_token: refreshToken });

    const drive = google.drive({ version: 'v3', auth });
    
    // Find all securevault-backup JSON files
    const res = await drive.files.list({
      q: "mimeType='application/json' and name contains 'securevault-backup' and trashed=false",
      fields: 'files(id, name, createdTime, size)',
      orderBy: 'createdTime desc'
    });

    return res.data.files || [];
  }

  async downloadFile(userId: string, fileId: string) {
    const config = await this.getConfig(userId);
    if (!config) throw new BadRequestException('Backup not configured');

    const refreshToken = this.decryptToken(config.encryptedToken);
    const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
    auth.setCredentials({ refresh_token: refreshToken });

    const drive = google.drive({ version: 'v3', auth });
    
    const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
    return res.data;
  }
}
