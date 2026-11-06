import type { IncomingMessage, ServerResponse } from 'http';
import https from 'https';

/**
 * Split text into sentence chunks under 180 characters so Google Translate TTS
 * endpoint accepts every piece without throwing 400 Bad Request.
 */
function splitTextChunks(text: string, maxLen = 175): string[] {
  const clean = text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  if (clean.length <= maxLen) return [clean];

  const sentences = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [clean];
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;
    if ((current + ' ' + trimmed).trim().length <= maxLen) {
      current = (current + ' ' + trimmed).trim();
    } else {
      if (current) chunks.push(current);
      if (trimmed.length <= maxLen) {
        current = trimmed;
      } else {
        const words = trimmed.split(' ');
        current = '';
        for (const word of words) {
          if ((current + ' ' + word).trim().length <= maxLen) {
            current = (current + ' ' + word).trim();
          } else {
            if (current) chunks.push(current);
            current = word;
          }
        }
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function fetchGoogleTtsChunk(chunk: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const targetUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=en&client=tw-ob`;
    https
      .get(
        targetUrl,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: '*/*',
          },
        },
        res => {
          if (res.statusCode !== 200) {
            reject(new Error(`Google TTS responded with status ${res.statusCode}`));
            return;
          }
          const data: Buffer[] = [];
          res.on('data', chunkBuffer => data.push(chunkBuffer));
          res.on('end', () => resolve(Buffer.concat(data)));
        }
      )
      .on('error', reject);
  });
}

export default async function handler(
  req: IncomingMessage & { query?: Record<string, string> },
  res: ServerResponse
) {
  // Allow cross-origin requests so preview & interview work across web and native shells
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  let text = '';
  if (req.url) {
    try {
      const parsed = new URL(req.url, 'http://localhost');
      text = parsed.searchParams.get('text') || '';
    } catch {
      text = '';
    }
  }

  if (!text && req.query && typeof req.query.text === 'string') {
    text = req.query.text;
  }

  const cleanText = text.replace(/<[^>]*>/g, '').trim();
  if (!cleanText) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Text query parameter is required' }));
    return;
  }

  try {
    const chunks = splitTextChunks(cleanText, 175);
    const audioBuffers: Buffer[] = [];

    // Fetch chunks sequentially to preserve speech order
    for (const chunk of chunks) {
      const buffer = await fetchGoogleTtsChunk(chunk);
      audioBuffers.push(buffer);
    }

    const combinedMp3 = Buffer.concat(audioBuffers);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', combinedMp3.length);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    res.end(combinedMp3);
  } catch (error) {
    console.error('TTS handler error:', error);
    if (!res.headersSent) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Failed to synthesize speech audio' }));
    }
  }
}
