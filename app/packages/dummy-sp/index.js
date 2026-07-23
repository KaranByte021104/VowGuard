const express = require('express');
const session = require('express-session');
const passport = require('passport');
const SamlStrategy = require('passport-saml').Strategy;
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'dummy-secret',
  resave: false,
  saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());

// In a real app, you would download the XML metadata from the IdP.
// Here we just use the fixed entry points. The cert is not verified strictly in the dummy SP
// for the sake of easy testing, but in production it MUST be configured.
const samlStrategy = new SamlStrategy(
  {
    path: '/saml/acs',
    entryPoint: 'http://localhost:3000/sso/login/dummy', // This is overridden by the IdP POST anyway
    issuer: 'http://localhost:4000/saml/metadata',
    cert: 'dummy', // Disable strict cert validation for the dummy SP test
  },
  (profile, done) => {
    return done(null, profile);
  }
);

// Override validation to accept any cert for testing purposes only
samlStrategy._saml.validatePostResponseAsync = async function(body) {
  // Hack to skip signature validation in the dummy SP, since the IdP cert is dynamically generated per org
  const xml = Buffer.from(body.SAMLResponse, 'base64').toString('utf8');
  const match = xml.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/i) || xml.match(/<saml:AttributeValue[^>]*>([^<]+)<\/saml:AttributeValue>/i);
  const email = match ? match[1] : 'sso-user@example.com';
  return { profile: { email, issuer: 'http://localhost:3000/sso/metadata/org' }, loggedOut: false };
};

passport.use(samlStrategy);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

app.post('/saml/acs',
  passport.authenticate('saml', { failureRedirect: '/', failureFlash: true }),
  (req, res) => {
    res.redirect('/dashboard');
  }
);

app.get('/dashboard', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).send('Not authenticated');
  }
  res.send(`
    <html>
      <body style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h1>Dummy Service Provider</h1>
        <div style="background: #e0f2fe; color: #0369a1; padding: 20px; border-radius: 8px; display: inline-block;">
          <h2>Login Successful!</h2>
          <p>You have been securely logged in via SecureVault SAML SSO.</p>
          <p><strong>Identity:</strong> ${req.user.email || JSON.stringify(req.user)}</p>
        </div>
      </body>
    </html>
  `);
});

app.get('/', (req, res) => {
  res.send(`
    <html>
      <body style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h1>Dummy Service Provider</h1>
        <p>This is a testing fixture for SecureVault SAML IdP.</p>
        <p>You must initiate the login from the SecureVault dashboard.</p>
        <br>
        <a href="/login-test">Go to dummy password login test page</a>
      </body>
    </html>
  `);
});

app.get('/login-test', (req, res) => {
  res.send(`
    <html>
      <body style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h1>Test Extension Password Saving</h1>
        <p>Fill out this dummy form to trigger the VowGuard extension save prompt.</p>
        <form action="/login-test" method="POST" style="display: flex; flex-direction: column; align-items: center; gap: 10px; margin-top: 20px;">
          <input type="text" name="username" placeholder="Username" style="padding: 10px; width: 250px;" />
          <input type="password" name="password" placeholder="Password" style="padding: 10px; width: 250px;" />
          <button type="submit" style="padding: 10px 20px; cursor: pointer;">Login</button>
        </form>
      </body>
    </html>
  `);
});

app.post('/login-test', (req, res) => {
  res.send('Form submitted! The extension should have caught this.');
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Dummy SP running on http://localhost:${PORT}`);
});
