import { buffer } from 'micro';
import { FormData } from 'formdata-node';
import { Blob } from 'buffer';
import fetch from 'node-fetch';

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Only POST allowed' });

  const API_KEY = process.env.API_AUTH_KEY;
  const CATBOX_USERHASH = process.env.CATBOX_USERHASH;

  if (req.headers['x-api-key'] !== API_KEY) {
    return res.status(401).json({ error: 'Invalid or missing x-api-key' });
  }

  let rawBody;
  try {
    rawBody = await buffer(req);
  } catch {
    return res.status(400).json({ error: 'Unable to read body buffer' });
  }

  let body;
  try {
    body = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const { id, type, filename, mimetype, data } = body;
  if (!id || !type || !filename || !mimetype || !data) {
    return res.status(400).json({ error: 'Missing fields', detail: body });
  }

  let fileBuffer;
  try {
    fileBuffer = Buffer.from(data, 'base64');
  } catch {
    return res.status(400).json({ error: 'Invalid base64 data' });
  }

  const formData = new FormData();
  formData.set('reqtype', 'fileupload');
  formData.set('userhash', CATBOX_USERHASH);
  formData.set('fileToUpload', new Blob([fileBuffer], { type: mimetype }), filename);

  try {
    const uploadRes = await fetch('https://catbox.moe/user/api.php', {
      method: 'POST',
      body: formData,
    });
    const link = await uploadRes.text();

    if (!link.startsWith('http')) {
      throw new Error(link);
    }

    return res.status(200).json({
      success: true,
      message: '✅ Chatbot ya tura audio kuma an dawo da link:',
      id,
      type,
      link,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Upload failed', detail: err.message });
  }
}
