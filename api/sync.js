const TASKS_KEY = 'tracker_tasks';

async function redisCommand(command, args) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) throw new Error('KV_REST_API_URL or KV_REST_API_TOKEN not configured');

  const response = await fetch(`${url}/${command}/${args.map(a => encodeURIComponent(a)).join('/')}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, state } = req.body;

  try {
    if (action === 'load') {
      const raw = await redisCommand('get', [TASKS_KEY]);
      if (!raw) return res.status(200).json({ state: null });
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return res.status(200).json({ state: parsed });
    }

    if (action === 'save') {
      if (!state) return res.status(400).json({ error: 'No state provided' });
      await redisCommand('set', [TASKS_KEY, JSON.stringify(state)]);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action' });

  } catch (err) {
    console.error('Sync error:', err);
    return res.status(500).json({ error: err.message });
  }
}
