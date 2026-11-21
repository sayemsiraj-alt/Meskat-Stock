import type { IncomingMessage, ServerResponse } from 'http';
import {
  detectPwaAssetKind,
  generateDynamicPwaHttpResponse,
} from '../src/utils/pwaServerRenderer';

interface VercelLikeRequest extends IncomingMessage {
  query?: Record<string, string | string[] | undefined>;
}

interface VercelLikeResponse extends ServerResponse {
  status?: (code: number) => VercelLikeResponse;
  send?: (body: any) => void;
}

const firstHeader = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) return (value[0] || '').trim();
  if (typeof value === 'string') return value.split(',')[0].trim();
  return '';
};

export default async function handler(
  req: VercelLikeRequest,
  res: VercelLikeResponse
) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.end('');
    return;
  }

  const proto = firstHeader(req.headers?.['x-forwarded-proto']) || 'https';
  const host =
    firstHeader(req.headers?.['x-forwarded-host']) ||
    firstHeader(req.headers?.host) ||
    'localhost';
  const originUrl = `${proto}://${host}`;

  const params = new URLSearchParams();
  let pathname = '/';

  try {
    const parsedUrl = new URL(req.url || '/', originUrl);
    pathname = parsedUrl.pathname;
    parsedUrl.searchParams.forEach((value, key) => {
      params.set(key, value);
    });
  } catch {
    pathname = (req.url || '/').split('?')[0];
  }

  if (req.query && typeof req.query === 'object') {
    Object.entries(req.query).forEach(([key, value]) => {
      if (typeof value === 'string') {
        params.set(key, value);
      } else if (Array.isArray(value) && typeof value[0] === 'string') {
        params.set(key, value[0]);
      }
    });
  }

  const kind = detectPwaAssetKind(pathname, params) || 'manifest';
  const result = await generateDynamicPwaHttpResponse(kind, params, originUrl);

  res.statusCode = result.statusCode;
  res.setHeader('Content-Type', result.contentType);
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(result.bodyBuffer);
}
