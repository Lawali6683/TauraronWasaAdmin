import { IncomingForm } from 'formidable';
import fs from 'fs';
import { Catbox } from 'node-catbox';

export const config = {
  api: {
    bodyParser: false,
  },
};

const API_KEY = process.env.API_AUTH_KEY;
const USER_HASH = process.env.CATBOX_USERHASH;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Only POST allowed' });

  if (req.headers['x-api-key'] !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing x-api-key' });
  }

  const form = new IncomingForm({ keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(400).json({ error: 'Form parsing failed', detail: err.message });
    }

    const { id, type } = fields;
    const file = files.file;

    if (!id || !type || !file) {
      return res.status(400).json({ error: 'Missing id, type, or file' });
    }

    try {
      const catbox = new Catbox(USER_HASH);
      const response = await catbox.uploadFile({ path: file.filepath });

      return res.status(200).json({
        success: true,
        id,
        type,
        link: response,
      });
    } catch (e) {
      return res.status(500).json({ error: 'Upload to Catbox failed', detail: e.message });
    }
  });
}
