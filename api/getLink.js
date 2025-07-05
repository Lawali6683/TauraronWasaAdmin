import { buffer } from 'micro';
import fetch from 'node-fetch';

export const config = {
  api: {
    bodyParser: false, 
    externalResolver: true,
  },
};

const API_AUTH_KEY = process.env.API_AUTH_KEY;

function vercelLongError(err, detail) {
  // Formats errors clearly for debugging
  return `[VercelLongError]\n${err?.stack || err?.message || err}\n${detail ? (typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2)) : ''}`;
}

async function parseBody(req) {
  // Accept both JSON and raw
  let body;
  try {
    const raw = await buffer(req);
    if (
      req.headers['content-type'] &&
      req.headers['content-type'].includes('application/json')
    ) {
      body = JSON.parse(raw.toString('utf8'));
    } else {
      body = JSON.parse(raw.toString('utf8')); // fallback
    }
  } catch (e) {
    throw new Error('Unable to parse JSON body');
  }
  return body;
}

export default async function handler(req, res) {
  // --- CORS for any domain (all origins) ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Only POST allowed',
      detail: vercelLongError('Method not allowed'),
    });
  }

  // --- API Key auth: check x-api-key header matches .env value ---
  const reqKey = req.headers['x-api-key'];
  if (!API_AUTH_KEY || reqKey !== API_AUTH_KEY) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid or missing x-api-key',
      detail: 'The x-api-key header is required and must match the backend API_AUTH_KEY.',
    });
  }

  let filename, mimetype, data;
  try {
    const body = await parseBody(req);
    filename = body.filename;
    mimetype = body.mimetype;
    data = body.data;
    if (!filename || !mimetype || !data) {
      throw new Error('Missing fields');
    }
  } catch (e) {
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON body or missing fields',
      detail: vercelLongError(e),
    });
  }

  // Decode base64
  let fileBuffer;
  try {
    fileBuffer = Buffer.from(data, 'base64');
    if (!fileBuffer || !fileBuffer.length) throw new Error('Buffer empty');
  } catch (e) {
    return res.status(400).json({
      success: false,
      error: 'Invalid base64',
      detail: vercelLongError(e),
    });
  }

  let FormData, Blob;
  try {
    FormData = (await import('formdata-node')).FormData;
    Blob = (await import('formdata-node')).Blob;
  } catch {
    // fallback to global if exists
    FormData = global.FormData;
    Blob = global.Blob;
  }
  if (!FormData || !Blob) {
    return res.status(500).json({
      success: false,
      error: 'FormData/Blob not available in this runtime',
      detail: vercelLongError('Missing FormData/Blob'),
    });
  }

  // Prepare upload
  let formData;
  try {
    formData = new FormData();
    formData.append('reqtype', 'fileupload');
    formData.append('userhash', process.env.CATBOX_USERHASH || '');
    formData.append('fileToUpload', new Blob([fileBuffer], { type: mimetype }), filename);
  } catch (e) {
    return res.status(500).json({
      success: false,
      error: 'Failed to prepare FormData',
      detail: vercelLongError(e),
    });
  }

  // Upload to Catbox
  try {
    const r = await fetch('https://catbox.moe/user/api.php', {
      method: 'POST',
      body: formData,
    });
    const text = await r.text();
    if (text.startsWith('http')) {
      // Success!
      return res.status(200).json({ success: true, link: text });
    } else {
      // Catbox error
      throw new Error(text);
    }
  } catch (err) {
    // Full error detail in vercelLongError
    return res.status(500).json({
      success: false,
      error: 'Upload failed',
      detail: vercelLongError(err),
    });
  }
}
