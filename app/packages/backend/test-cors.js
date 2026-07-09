const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Origin': 'http://localhost:5173'
  }
}, res => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers, null, 2)}`);
  res.setEncoding('utf8');
  res.on('data', chunk => console.log(`BODY: ${chunk}`));
});

req.on('error', e => console.error(`problem with request: ${e.message}`));
req.write(JSON.stringify({ email: 'stkabirdio@gmail.com', loginPassword: 'Password123!' }));
req.end();
