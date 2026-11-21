import type { IncomingMessage, ServerResponse } from 'http';
import { handler as netlifyCourierHandler } from '../netlify/functions/courier.js';

interface VercelLikeRequest extends IncomingMessage {
  body?: unknown;
}

const readRawBody = async (req: VercelLikeRequest): Promise<string | null> => {
  if (typeof req.body === 'string') return req.body;
  if (req.body && typeof req.body === 'object') {
    return JSON.stringify(req.body);
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return chunks.length > 0 ? Buffer.concat(chunks).toString('utf-8') : null;
};

export default async function handler(
  req: VercelLikeRequest,
  res: ServerResponse
) {
  const rawBody = req.method === 'POST' ? await readRawBody(req) : null;
  const result = await netlifyCourierHandler({
    httpMethod: req.method,
    body: rawBody,
  });

  res.statusCode = result.statusCode;
  Object.entries(result.headers || {}).forEach(([k, v]) => {
    res.setHeader(k, v);
  });
  res.end(result.body || '');
}
