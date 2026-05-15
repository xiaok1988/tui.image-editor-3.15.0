// Supported models on Hugging Face Inference API (free tier)
const MODELS = {
  sdxl: 'stabilityai/stable-diffusion-xl-base-1.0',
  flux: 'black-forest-labs/FLUX.1-schnell',
  sd21: 'stabilityai/stable-diffusion-2-1',
};
const HF_API_BASE = 'https://api-inference.huggingface.co/models';

// POST /api/generate-image
// Body: { prompt, negativePrompt?, numImages?, model? }
// Response: { images: ["data:image/png;base64,..."], model, prompt }
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
  const url = `${HF_API_BASE}/${modelId}`;
  const count = Math.min(Math.max(numImages, 1), 4);

  try {
    const requests = Array.from({ length: count }, () =>
      fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            negative_prompt: negativePrompt || undefined,
            num_inference_steps: 30,
          },
        }),
      })
    );

    const responses = await Promise.all(requests);

    const images = await Promise.all(
      responses.map(async (resp, i) => {
        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(`HF API error ${resp.status}: ${errText}`);
        }

        const buffer = await resp.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        return `data:image/png;base64,${base64}`;
      })
    );

    res.status(200).json({
      images,
      model: modelId,
      prompt,
    });
  } catch (error) {
    console.error('HF proxy error:', error);
    res.status(502).json({ error: error.message || 'Failed to reach Hugging Face API' });
  }
};