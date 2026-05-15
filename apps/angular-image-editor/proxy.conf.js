const PROXY_CONFIG = {
  '/api': {
    target: process.env['VERTEX_AI_BASE_URL'] || 'https://us-central1-aiplatform.googleapis.com',
    secure: true,
    changeOrigin: true,
    pathRewrite: {
      '^/api': '',
    },
    timeout: 600000,
    proxyTimeout: 600000,
    logLevel: 'debug',
    followRedirects: true,
    toProxy: true,
    headers: {
      Connection: 'keep-alive',
      Authorization: `Bearer ${process.env['VERTEX_AI_ACCESS_TOKEN'] || ''}`,
    },
  },
};

module.exports = PROXY_CONFIG;