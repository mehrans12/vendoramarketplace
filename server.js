import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const BACKEND_URL = process.env.BACKEND_URL || process.env.VITE_BACKEND_URL || 'http://127.0.0.1:5001';

// Proxy /api requests to Backend Server
app.all('/api/*', async (req, res) => {
  try {
    const targetUrl = `${BACKEND_URL.replace(/\/$/, '')}${req.url}`;
    const headers = { ...req.headers };
    delete headers.host;

    const fetchOptions = {
      method: req.method,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      }
    };

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body && Object.keys(req.body).length > 0) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const backendRes = await fetch(targetUrl, fetchOptions);
    const contentType = backendRes.headers.get('content-type') || '';
    
    res.status(backendRes.status);
    if (contentType.includes('application/json')) {
      const data = await backendRes.json();
      return res.json(data);
    } else {
      const text = await backendRes.text();
      return res.send(text);
    }
  } catch (err) {
    console.error('API Proxy error:', err.message);
    return res.status(502).json({ error: 'Backend service unavailable. Please check BACKEND_URL configuration.' });
  }
});

// Serve static assets from the Vite build directory (dist)
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback to index.html for SPA client-side routing (React Router)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Vendora Frontend serving on http://0.0.0.0:${PORT} (Proxying /api to ${BACKEND_URL})`);
});
