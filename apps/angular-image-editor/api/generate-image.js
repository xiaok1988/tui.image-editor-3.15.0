const https = require('https');

// Supported models on Hugging Face Inference API
const MODELS = {
  sdxl: 'stabilityai/stable-diffusion-xl-base-1.0',
  qwen: 'Qwen/Qwen-Image-Edit',
  sd21: 'stabilityai/stable-diffusion-2-1',
};

function hfRequest(modelId, apiToken, body) {
  return new Promise((resolve, reject) => {
    const url = `https://router.huggingface.co/hf-inference/models/${modelId}`;
    console.log('HF request URL:', url);

    const data = JSON.stringify(body);
    const req = https.request(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'User-Agent': 'VercelFunction/1.0',
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        console.log('HF response status:', res.statusCode, 'size:', buffer.length);

        if (res.statusCode === 503) {
          // Model loading — return a retryable error
          resolve({
            ok: false,
            status: 503,
            error: JSON.stringify({
              error: 'Model is loading, please retry in ~30 seconds',
              estimated_time: 30,
            }),
          });
          return;
        }

        if (res.statusCode !== 200) {
          const text = buffer.toString('utf-8').slice(0, 500);
          console.error('HF error body:', text);
          resolve({
            ok: false,
            status: res.statusCode || 500,
            error: text,
          });
          return;
        }

        resolve({ ok: true, buffer });
      });
    });

    req.on('error', (err) => {
      console.error('HF request error:', err.message);
      reject(err);
    });

    req.write(data);
    req.end();
  });
}

// POST /api/generate-image
// Body: { prompt, negativePrompt?, numImages?, model? }
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed, use POST' });
  }

  const apiToken = process.env.HF_API_TOKEN;
  if (!apiToken) {
    return res.status(500).json({ error: 'Server misconfiguration: HF_API_TOKEN not set' });
  }

  const { prompt, negativePrompt, numImages = 1, model = 'flux' } = req.body || {};

  if (!prompt) {
    return res.status(400).json({ error: 'Missing required field: prompt' });
  }

  const modelId = MODELS[model] || MODELS['flux'];
  const count = Math.min(Math.max(numImages, 1), 4);

  try {
    const results = await Promise.all(
      Array.from({ length: count }, () =>
        hfRequest(modelId, apiToken, {
          inputs: prompt,
          parameters: {
            negative_prompt: negativePrompt || undefined,
            num_inference_steps: 30,
          },
        })
      )
    );

    // Check for errors
    const errors = results.filter((r) => !r.ok);
    if (errors.length > 0) {
      const firstErr = errors[0];
      return res.status(firstErr.status).json({
        error: `HF API returned ${firstErr.status}`,
        detail: firstErr.error,
      });
    }

    const images = results.map((r) => {
      const base64 = r.buffer.toString('base64');
      return `data:image/png;base64,${base64}`;
    });

    res.status(200).json({ images, model: modelId, prompt });
  } catch (error) {
    console.error('HF proxy error:', error);
    res.status(502).json({ error: error.message || 'Failed to reach Hugging Face API' });
  }
};