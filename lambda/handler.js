/**
 * AWS Lambda handler for AI API proxy
 * Supports both Claude and Gemini APIs
 * Handles CORS and forwards requests to appropriate AI provider
 * Supports streaming responses for better UX
 */

import { pipeline } from 'stream/promises';

export const handler = async (event) => {
  // Note: CORS is handled by Lambda Function URL configuration
  // No need to add CORS headers here to avoid duplicates

  try {
    // Parse request body
    const requestBody = JSON.parse(event.body);

    // Determine AI provider from header or request body
    const aiProvider = event.headers['x-ai-provider'] ||
                       requestBody.provider ||
                       process.env.DEFAULT_AI_PROVIDER ||
                       'claude';

    console.log(`[Lambda] Routing to ${aiProvider} API`);

    // Check if streaming is requested
    if (requestBody.stream === true) {
      console.log('[Lambda] Streaming mode enabled');
      return await handleStreamingRequest(aiProvider, requestBody);
    }

    if (aiProvider === 'gemini') {
      return await handleGemini(requestBody);
    } else {
      return await handleClaude(requestBody);
    }

  } catch (error) {
    console.error('[Lambda] Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};

/**
 * Handle streaming requests
 */
async function handleStreamingRequest(aiProvider, requestBody) {
  if (aiProvider === 'claude') {
    return await handleClaudeStreaming(requestBody);
  } else {
    // Fallback to non-streaming for other providers
    return await handleGemini(requestBody);
  }
}

/**
 * Handle Claude streaming API requests
 */
async function handleClaudeStreaming(requestBody) {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    throw new Error('CLAUDE_API_KEY not configured');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('[Claude] API error:', response.status, errorData);
    return {
      statusCode: response.status,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: errorData })
    };
  }

  // Read the streaming response
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let chunks = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            chunks.push(parsed);
          } catch (e) {
            console.error('[Claude] Failed to parse chunk:', e);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Return accumulated chunks for Lambda (not true streaming, but better than nothing)
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ chunks })
  };
}

/**
 * Handle Claude API requests (non-streaming)
 */
async function handleClaude(requestBody) {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    throw new Error('CLAUDE_API_KEY not configured');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(requestBody)
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('[Claude] API error:', response.status, data);
    return {
      statusCode: response.status,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: data })
    };
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  };
}

/**
 * Handle Gemini API requests
 */
async function handleGemini(requestBody) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  // Extract model from request or use default
  const model = requestBody.model || 'gemini-2.0-flash-exp';
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('[Gemini] API error:', response.status, data);
    return {
      statusCode: response.status,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: data })
    };
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  };
}
