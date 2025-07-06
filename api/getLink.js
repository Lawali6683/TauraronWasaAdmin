import { IncomingForm } from 'formidable';
import fs from 'fs';
import { FormData } from 'formdata-node';
import fetch from 'node-fetch';
import { Blob } from 'buffer';

export const config = {
  api: {
    bodyParser: false
  }
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

  const form = new IncomingForm({ keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(400).json({ error: 'Form parsing failed', detail: err.message });

    const { id, type } = fields;
    const file = files.file;

    if (!id || !type || !file) {
      return res.status(400).json({ error: 'Missing id, type or file' });
    }

    try {
      const fileBuffer = fs.readFileSync(file.filepath);
      const blob = new Blob([fileBuffer], { type: file.mimetype });

      const formData = new FormData();
      formData.set('reqtype', 'fileupload');
      formData.set('userhash', CATBOX_USERHASH);
      formData.set('fileToUpload', blob, file.originalFilename);

      const response = await fetch('https://catbox.moe/user/api.php', {
        method: 'POST',
        body: formData
      });

      const link = await response.text();

      if (!link.startsWith('http')) {
        return res.status(500).json({ error: 'Catbox upload failed', detail: link });
      }

      return res.status(200).json({
        success: true,
        id,
        type,
        link
      });
    } catch (e) {
      return res.status(500).json({ error: 'Upload failed', detail: e.message });
    }
  });
}
