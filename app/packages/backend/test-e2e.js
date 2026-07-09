const http = require('http');

async function doFetch(path, method, body, cookie) {
  return new Promise((resolve, reject) => {
    const dataString = body ? JSON.stringify(body) : '';
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataString),
        ...(cookie ? { 'Cookie': cookie } : {})
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const setCookie = res.headers['set-cookie'];
        resolve({
          status: res.statusCode,
          data: data,
          cookie: setCookie ? setCookie.join('; ') : cookie
        });
      });
    });
    req.on('error', reject);
    req.write(dataString);
    req.end();
  });
}

async function main() {
  // Login as secondary user
  console.log("Logging in as karansinh...");
  const loginRes = await doFetch('/auth/login', 'POST', {
    email: 'karansinh.gohil0211@gmail.com',
    loginPassword: 'Password123!' // Assuming standard password, if not, I can't login.
  });
  console.log("Login status:", loginRes.status);
  if (loginRes.status !== 200) {
    console.log("Failed to login, trying stkabirdio");
    return;
  }
  
  const cookie = loginRes.cookie;
  
  // Fetch emergency vault
  console.log("Fetching vault...");
  const vaultRes = await doFetch('/emergency-access/vault/65c96a01-0585-4a0a-af05-0121ff85d18e', 'GET', null, cookie);
  console.log("Vault status:", vaultRes.status);
  console.log("Vault response:", vaultRes.data);
}

main().catch(console.error);
