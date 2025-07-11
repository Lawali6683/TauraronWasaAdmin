import { IncomingForm } from 'formidable';
import fs from 'fs';
import fetch from 'node-fetch';
import FormData from 'form-data';

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

  const form = new IncomingForm({
    keepExtensions: true,
    multiples: false
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Form parsing failed:', err);
      return res.status(400).json({ error: 'Form parsing failed', detail: err.message });
    }

    const id = Array.isArray(fields.id) ? fields.id[0] : fields.id;
    const type = Array.isArray(fields.type) ? fields.type[0] : fields.type;
    const file = Array.isArray(files.file) ? files.file[0] : files.file;

    console.log('Parsed Fields:', { id, type });
    console.log('Parsed File:', file);

    if (!id || !type || !file || !file.filepath) {
      return res.status(400).json({
        error: 'Missing id, type or file',
        detail: { id, type, file: file || 'undefined' }
      });
    }

    try {
      const stream = fs.createReadStream(file.filepath);
      const formData = new FormData();

      formData.append('reqtype', 'fileupload');
      formData.append('userhash', CATBOX_USERHASH);
      formData.append('fileToUpload', stream, {
        filename: file.originalFilename || 'upload.webm',
        contentType: file.mimetype || 'audio/webm'
      });

      const response = await fetch('https://catbox.moe/user/api.php', {
        method: 'POST',
        body: formData,
        headers: formData.getHeaders(),
      });

      const link = await response.text();

      if (!link.startsWith('http')) {
        return res.status(500).json({ error: 'Catbox upload failed', detail: link });
      }

      return res.status(200).json({
        success: true,
        id,
        type,
        link,
      });
    } catch (e) {
      console.error('Upload failed:', e);
      return res.status(500).json({ error: 'Upload failed', detail: e.stack || e.message });
    }
  });
}
