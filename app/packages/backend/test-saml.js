const samlify = require('samlify');
const forge = require('node-forge');

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

const idp = samlify.IdentityProvider({
  entityID: 'http://idp',
  singleSignOnService: [{ Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST', Location: 'http://idp/login' }],
  isAssertionEncrypted: false,
  signingCert: pemCertificate,
  privateKey: pemPrivateKey,
});

const sp = samlify.ServiceProvider({
  entityID: 'http://sp',
  assertionConsumerService: [{ Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST', Location: 'http://sp/acs' }]
});

async function run() {
  const { context } = await idp.createLoginResponse(sp, { extract: { request: { id: 'dummy' } } }, 'post', {
    extract: { principalName: 'user@example.com', nameID: 'user@example.com' }
  });
  console.log('CONTEXT START');
  console.log(context);
  console.log('CONTEXT END');
}

run().catch(console.error);
