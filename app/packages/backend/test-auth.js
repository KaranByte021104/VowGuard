const jwt = require('jsonwebtoken');
const http = require('http');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const contact = await prisma.user.findFirst({ where: { email: 'karansinh.gohil0211@gmail.com' } });
  
  const payload = { email: contact.email, sub: contact.id, organizationId: contact.organizationId, role: contact.role };
  // The JWT secret used in auth.module is usually process.env.JWT_SECRET or 'your-secret-key'
  const token = jwt.sign(payload, 'super-secret-sprint-2', { expiresIn: '1d' });

  console.log("Token:", token);

  const req = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/emergency-access/vault/65c96a01-0585-4a0a-af05-0121ff85d18e',
    method: 'GET',
    headers: {
      'Cookie': `access_token=${token}`
    }
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log("Status:", res.statusCode);
      console.log("Response:", data);
    });
  });
  
  req.on('error', console.error);
  req.end();
}

main().finally(() => prisma.$disconnect());
