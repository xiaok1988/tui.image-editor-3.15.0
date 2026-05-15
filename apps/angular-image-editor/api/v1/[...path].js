const VERTEX_AI_BASE_URL = 'https://us-central1-aiplatform.googleapis.com';

module.exports = async function handler(req, res) {
  // Only allow POST (the Vertex AI predict endpoint requires POST)
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: `This endpoint only accepts POST requests, received ${req.method}`,
    });
  }

  const pathSegments = req.query.path;
  if (!pathSegments || !Array.isArray(pathSegments)) {
    return res.status(400).json({ error: 'Invalid API path' });
  }

  const targetPath = '/v1/' + pathSegments.join('/');
  const targetUrl = `${VERTEX_AI_BASE_URL}${targetPath}`;

  const accessToken = process.env.VERTEX_AI_ACCESS_TOKEN;
  if (!accessToken) {
    console.error('VERTEX_AI_ACCESS_TOKEN environment variable is not set');
    return res.status(500).json({ error: 'Server misconfiguration: access token not set' });
  }

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        Connection: 'keep-alive',
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();

    res.status(response.status).json(data);
  } catch (error) {
    console.error('Vertex AI proxy error:', error);
    res.status(502).json({
      error: 'Failed to reach Vertex AI API',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};