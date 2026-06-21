export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!clientId || !clientSecret) return res.status(500).json({ error: 'Google credentials not configured' });

  // Get tokens from cookie
  const cookieHeader = req.headers.cookie || '';
  const tokenCookie = cookieHeader.split(';').map(c => c.trim()).find(c => c.startsWith('gmail_tokens='));

  if (!tokenCookie) return res.status(401).json({ error: 'NOT_AUTHED' });

  let tokens;
  try {
    tokens = JSON.parse(Buffer.from(tokenCookie.split('=')[1], 'base64').toString());
  } catch(e) {
    return res.status(401).json({ error: 'NOT_AUTHED' });
  }

  // Refresh token if expired
  if (Date.now() > tokens.expiry - 60000) {
    try {
      const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: tokens.refresh_token,
          grant_type: 'refresh_token',
        }),
      });
      const refreshed = await refreshRes.json();
      if (refreshed.access_token) {
        tokens.access_token = refreshed.access_token;
        tokens.expiry = Date.now() + (refreshed.expires_in * 1000);
        const encoded = Buffer.from(JSON.stringify(tokens)).toString('base64');
        res.setHeader('Set-Cookie', `gmail_tokens=${encoded}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`);
      }
    } catch(e) {
      return res.status(401).json({ error: 'NOT_AUTHED' });
    }
  }

  const accessToken = tokens.access_token;
  const { action, email, listIds } = req.body;

  try {
    if (action === 'fetch') {
      // Search Gmail for [task] emails
      const searchRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=subject:%5Btask%5D&maxResults=15`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const searchData = await searchRes.json();

      if (!searchData.messages || searchData.messages.length === 0) {
        return res.status(200).json({ emails: [] });
      }

      // Fetch each message
      const emails = await Promise.all(searchData.messages.map(async (m) => {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const msg = await msgRes.json();
        const headers = msg.payload?.headers || [];
        const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
        const from = headers.find(h => h.name === 'From')?.value || '';
        const date = headers.find(h => h.name === 'Date')?.value || '';

        // Extract body text
        let body = msg.snippet || '';
        const parts = msg.payload?.parts || [];
        const textPart = parts.find(p => p.mimeType === 'text/plain');
        if (textPart?.body?.data) {
          body = Buffer.from(textPart.body.data, 'base64').toString('utf-8').slice(0, 600);
        } else if (msg.payload?.body?.data) {
          body = Buffer.from(msg.payload.body.data, 'base64').toString('utf-8').slice(0, 600);
        }

        return { id: m.id, subject, from, date, body };
      }));

      return res.status(200).json({ emails });
    }

    if (action === 'parse') {
      if (!anthropicKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          messages: [{
            role: 'user',
            content: `Parse this email into a task.
Subject: "${email.subject}"
Body: "${email.body}"

Return ONLY a valid JSON object (no markdown):
{
  "name": "clear task name",
  "priority": "High" | "Medium" | "Low",
  "category": "category if obvious, else empty string",
  "doDate": "YYYY-MM-DD if a do date is mentioned, else empty string",
  "deadlineDate": "YYYY-MM-DD if a deadline is mentioned, else empty string",
  "notes": "key details from the body, 1-2 sentences max",
  "listId": "best matching list id from: ${(listIds||[]).join(', ')} — default to first one"
}
Default priority: Medium.`
          }]
        })
      });

      const data = await response.json();
      const textBlock = data.content?.find(b => b.type === 'text');
      if (!textBlock) return res.status(500).json({ error: 'No response from AI' });
      const parsed = JSON.parse(textBlock.text.replace(/```json|```/g, '').trim());
      return res.status(200).json({ task: parsed });
    }

    return res.status(400).json({ error: 'Unknown action' });

  } catch (err) {
    console.error('Gmail API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
