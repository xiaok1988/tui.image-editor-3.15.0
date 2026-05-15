const VERTEX_AI_BASE_URL = 'https://us-central1-aiplatform.googleapis.com';

// POST /api/generate-image
// Body: { projectId, location, publisher, modelName, instances, parameters }
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed, use POST' });
  }

  const accessToken = process.env.VERTEX_AI_ACCESS_TOKEN;
  if (!accessToken) {
    return res.status(500).json({ error: 'Server misconfiguration: VERTEX_AI_ACCESS_TOKEN not set' });
  }

  try {
    const { projectId, location, publisher, modelName, instances, parameters } = req.body;

    const predictPath = `/v1/projects/${projectId}/locations/${location}/publishers/${publisher}/models/${modelName}:predict`;

    const response = await fetch(`${VERTEX_AI_BASE_URL}${predictPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        Connection: 'keep-alive',
      },
      body: JSON.stringify({ instances, parameters }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Vertex AI error ${response.status}:`, errorText);
      return res.status(response.status).json({
        error: `Vertex AI returned ${response.status}`,
        detail: errorText,
      });
    }

    const data = await response.json();

    res.status(200).json(data);
  } catch (error) {
    console.error('Vertex AI proxy error:', error);
    res.status(502).json({ error: 'Failed to reach Vertex AI API', detail: error.message });
  }
};