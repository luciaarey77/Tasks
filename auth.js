export default async function handler(req, res) {
  const { code, error } = req.query;

  if (error) {
    return res.send(`<html><body>
      <p>Authorization failed: ${error}</p>
      <a href="/">Go back</a>
    </body></html>`);
  }

  if (!code) {
    return res.status(400).send('No authorization code received');
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/api/auth`
      : 'http://localhost:3000/api/auth';

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenRes.json();

    if (tokens.error) {
      return res.send(`<html><body>
        <p>Token exchange failed: ${tokens.error_description || tokens.error}</p>
        <a href="/">Go back</a>
      </body></html>`);
    }

    // Store tokens in a cookie (httpOnly, secure)
    const tokenData = JSON.stringify({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry: Date.now() + (tokens.expires_in * 1000),
    });

    const encoded = Buffer.from(tokenData).toString('base64');
    res.setHeader('Set-Cookie', `gmail_tokens=${encoded}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`);
    res.send(`<html><body>
      <p>✓ Gmail connected successfully!</p>
      <script>window.opener && window.opener.postMessage('gmail_authed', '*'); window.close();</script>
      <a href="/">Go back to tracker</a>
    </body></html>`);

  } catch (err) {
    console.error('Auth error:', err);
    res.status(500).send(`Error: ${err.message}`);
  }
}
