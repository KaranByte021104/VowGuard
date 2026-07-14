import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as forge from 'node-forge';
import * as samlify from 'samlify';

@Injectable()
export class SsoService {
  constructor(private prisma: PrismaService) {
    samlify.setSchemaValidator({
      validate: (response: string) => {
        // Simple validator bypass since we just generate assertions, not validate complex schema 
        // A real SP would do more strict validation, but samlify requires a validator to be set
        return Promise.resolve('valid');
      }
    });
  }

  async getSamlKeys(organizationId: string) {
    let org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organization not found');

    if (org.samlPrivateKey && org.samlCertificate) {
      return {
        privateKey: org.samlPrivateKey,
        certificate: org.samlCertificate
      };
    }

    // Generate RSA keys and self-signed certificate
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);
    
    const attrs = [{ name: 'commonName', value: 'SecureVault IdP' }];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.sign(keys.privateKey, forge.md.sha256.create());

    const pemPrivateKey = forge.pki.privateKeyToPem(keys.privateKey);
    const pemCertificate = forge.pki.certificateToPem(cert);

    org = await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        samlPrivateKey: pemPrivateKey,
        samlCertificate: pemCertificate
      }
    });

    return {
      privateKey: org.samlPrivateKey,
      certificate: org.samlCertificate
    };
  }

  async createSamlApp(organizationId: string, data: { name: string; description?: string; acsUrl: string; audienceUri: string; }) {
    return this.prisma.sAMLApp.create({
      data: {
        ...data,
        organizationId
      }
    });
  }

  async updateSamlApp(appId: string, organizationId: string, data: { name?: string; description?: string; acsUrl?: string; audienceUri?: string; isEnabled?: boolean; }) {
    return this.prisma.sAMLApp.update({
      where: { id: appId, organizationId },
      data
    });
  }

  async getSamlApps(organizationId: string) {
    return this.prisma.sAMLApp.findMany({
      where: { organizationId },
      include: {
        _count: {
          select: { accesses: true }
        }
      }
    });
  }

  async getSamlApp(appId: string, organizationId: string) {
    const app = await this.prisma.sAMLApp.findUnique({
      where: { id: appId, organizationId },
      include: {
        accesses: {
          include: {
            user: { select: { id: true, email: true, role: true } }
          }
        }
      }
    });
    if (!app) throw new NotFoundException('SAML App not found');
    return app;
  }

  async grantAccess(appId: string, userId: string, organizationId: string) {
    // verify app belongs to org
    const app = await this.getSamlApp(appId, organizationId);
    return this.prisma.sAMLAppAccess.upsert({
      where: { appId_userId: { appId, userId } },
      create: { appId, userId },
      update: {}
    });
  }

  async revokeAccess(appId: string, userId: string, organizationId: string) {
    // verify app belongs to org
    const app = await this.getSamlApp(appId, organizationId);
    return this.prisma.sAMLAppAccess.delete({
      where: { appId_userId: { appId, userId } }
    }).catch(() => null); // ignore if not exists
  }

  async getUserAccessibleApps(userId: string, organizationId: string) {
    const accesses = await this.prisma.sAMLAppAccess.findMany({
      where: { userId },
      include: { app: true }
    });
    return accesses.map(a => a.app).filter(app => app.isEnabled && app.organizationId === organizationId);
  }

  async generateIdpMetadata(organizationId: string) {
    const { privateKey, certificate } = await this.getSamlKeys(organizationId);
    const idp = samlify.IdentityProvider({
      entityID: `http://localhost:3000/sso/metadata/${organizationId}`,
      singleSignOnService: [
        {
          Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
          Location: `http://localhost:3000/sso/login/${organizationId}`
        }
      ],
      signingCert: certificate as string,
      privateKey: privateKey as string,
      nameIDFormat: ['urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress'],
    });

    return idp.getMetadata();
  }

  async handleSpInitiatedLogin(userId: string, organizationId: string, samlRequestBase64: string, relayState: string) {
    const zlib = require('zlib');
    const buf = Buffer.from(decodeURIComponent(samlRequestBase64), 'base64');
    let xml = '';
    try {
      xml = zlib.inflateRawSync(buf).toString();
    } catch (e) {
      xml = buf.toString(); 
    }
    
    const issuerMatch = xml.match(/<saml:Issuer[^>]*>([^<]+)<\/saml:Issuer>/);
    if (!issuerMatch) throw new Error('Invalid SAMLRequest: No Issuer found');
    const audienceUri = issuerMatch[1].trim();

    let app = await this.prisma.sAMLApp.findFirst({
      where: { organizationId, audienceUri }
    });
    
    if (!app) {
      const apps = await this.prisma.sAMLApp.findMany({ where: { organizationId } });
      app = apps.find(a => a.audienceUri === audienceUri || a.audienceUri + '/' === audienceUri || a.audienceUri === audienceUri + '/') || null;
      if (!app) throw new NotFoundException('SAML App not found for this Issuer: ' + audienceUri);
    }

    const response = await this.initiateSamlLogin(userId, organizationId, app.id);
    return { ...response, relayState };
  }

  async initiateSamlLogin(userId: string, organizationId: string, appId: string) {
    const app = await this.getSamlApp(appId, organizationId);
    if (!app.isEnabled) throw new ForbiddenException('This application is disabled');

    const access = await this.prisma.sAMLAppAccess.findUnique({
      where: { appId_userId: { appId, userId } }
    });
    if (!access) throw new ForbiddenException('You do not have access to this application');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    const { privateKey, certificate } = await this.getSamlKeys(organizationId);

    const idp = samlify.IdentityProvider({
      entityID: `http://localhost:3000/sso/metadata/${organizationId}`,
      signingCert: certificate as string,
      privateKey: privateKey as string,
      isAssertionEncrypted: false,
      singleSignOnService: [
        {
          Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
          Location: `http://localhost:3000/sso/login/${organizationId}`
        }
      ]
    });

    const sp = samlify.ServiceProvider({
      entityID: app.audienceUri,
      assertionConsumerService: [{
        Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
        Location: app.acsUrl
      }]
    });

    const { context } = await idp.createLoginResponse(sp, { extract: { request: { id: 'dummy' } } } as any, 'post', {
      extract: {
        principalName: user?.email,
        nameID: user?.email
      }
    });

    return {
      acsUrl: app.acsUrl,
      samlResponse: context,
      relayState: ''
    };
  }
}
