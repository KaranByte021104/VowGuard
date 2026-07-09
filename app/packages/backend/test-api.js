const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/emergency-access/vault/65c96a01-0585-4a0a-af05-0121ff85d18e',
  method: 'GET',
};

// We need an auth token. Let's just create a test JWT or bypass auth.
// Actually, it's easier to just fetch directly using Prisma inside a script.
