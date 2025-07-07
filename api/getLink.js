import { IncomingForm } from 'formidable';
import fs from 'fs';
import fetch from 'node-fetch';

export const config = {
  api: {
    bodyParser: false,
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

  const form = new IncomingForm({ keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Form parsing failed:', err);
      return res.status(400).json({ error: 'Form parsing failed', detail: err.message });
    }

    const { id, type } = fields;
    const file = files.file;

    if (!id || !type || !file) {
      console.error('Missing id, type, or file', { id, type, file });
      return res.status(400).json({ error: 'Missing id, type or file', detail: { id, type, file } });
    }

    try {
      // Use stream for efficiency and memory safety
      const stream = fs.createReadStream(file.filepath);

      // Prepare FormData manually for Node.js (node-fetch v2/3 compatibility)
      const formData = new (require('form-data'))();
      formData.append('reqtype', 'fileupload');
      formData.append('userhash', CATBOX_USERHASH);
      formData.append('fileToUpload', stream, {
        filename: file.originalFilename,
        contentType: file.mimetype
      });

      const response = await fetch('https://catbox.moe/user/api.php', {
        method: 'POST',
        body: formData,
        headers: formData.getHeaders(),
      });

      const link = await response.text();

      // Log full Catbox response for debugging
      console.log('Catbox response:', link);

      // If Catbox returns an error, it will not be a URL
      if (!link.startsWith('http')) {
        console.error('Catbox upload failed:', link);
        return res.status(500).json({ error: 'Catbox upload failed', detail: link });
      }

      return res.status(200).json({
        success: true,
        id,
        type,
        link,
      });
    } catch (e) {
      // Log stack trace for Vercel long
      console.error('Upload failed:', e);
      return res.status(500).json({ error: 'Upload failed', detail: e.stack || e.message });
    }
  });
}
