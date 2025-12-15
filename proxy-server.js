const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const https = require('https');
const fs = require('fs');
const path = require('path');

const app = express();

// Enable CORS for all routes
app.use(cors({
  origin: ['https://stafflyhrms.netlify.app', 'http://localhost:8080'],
  credentials: true
}));

// Proxy configuration
const proxyOptions = {
  target: 'http://localhost:8080',
  changeOrigin: true,
  secure: false,
  logLevel: 'debug',
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Proxy error', details: err.message });
  }
};

// Create proxy middleware
app.use('/', createProxyMiddleware(proxyOptions));

// For development (HTTP)
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🔄 Proxy server running on http://localhost:${PORT}`);
  console.log(`📡 Proxying requests to: http://localhost:8080`);
});

// For production with self-signed certificate (HTTPS)
// Uncomment below if you want HTTPS proxy
/*
const httpsOptions = {
  key: fs.readFileSync(path.join(__dirname, 'server.key')),
  cert: fs.readFileSync(path.join(__dirname, 'server.cert'))
};

const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
https.createServer(httpsOptions, app).listen(HTTPS_PORT, () => {
  console.log(`🔒 HTTPS Proxy server running on https://localhost:${HTTPS_PORT}`);
  console.log(`📡 Proxying requests to: http://localhost:8080`);
});
*/