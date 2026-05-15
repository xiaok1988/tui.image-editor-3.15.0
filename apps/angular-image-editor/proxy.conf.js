// Local dev proxy — forwards /api/* to Hugging Face Inference API.
// Note: the Angular app calls /api/generate-image which runs via
// the Vercel serverless function (api/generate-image.js) in production.
// For local dev, use `vercel dev` to run the function, or enable mock mode.
const PROXY_CONFIG = {
  '/api': {
    target: 'https://api-inference.huggingface.co',
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
      Authorization: `Bearer ${process.env['HF_API_TOKEN'] || ''}`,
    },
  },
};

module.exports = PROXY_CONFIG;