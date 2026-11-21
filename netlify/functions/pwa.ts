import {
  detectPwaAssetKind,
  generateDynamicPwaHttpResponse,
} from '../../src/utils/pwaServerRenderer';

interface NetlifyEvent {
  path?: string;
  rawUrl?: string;
  httpMethod?: string;
  headers?: Record<string, string | undefined>;
  queryStringParameters?: Record<string, string | undefined> | null;
}

export const handler = async (event: NetlifyEvent) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
      body: '',
    };
  }

  const headersLower: Record<string, string> = {};
  Object.entries(event.headers || {}).forEach(([k, v]) => {
    if (typeof v === 'string' && v.trim()) {
      headersLower[k.toLowerCase()] = v.trim();
    }
  });

  const proto = (headersLower['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = (headersLower['x-forwarded-host'] || headersLower.host || 'localhost')
    .split(',')[0]
    .trim();
  const originUrl = `${proto}://${host}`;

  const params = new URLSearchParams();
  let pathname = event.path || '';

  if (event.rawUrl) {
    try {
      const parsed = new URL(event.rawUrl);
      if (!pathname) pathname = parsed.pathname;
      parsed.searchParams.forEach((value, key) => {
        params.set(key, value);
      });
    } catch {
      // ignore invalid rawUrl
    }
  }

  if (event.queryStringParameters) {
    Object.entries(event.queryStringParameters).forEach(([key, value]) => {
      if (typeof value === 'string') {
        params.set(key, value);
      }
    });
  }

  const kind = detectPwaAssetKind(pathname, params) || 'manifest';
  const result = await generateDynamicPwaHttpResponse(kind, params, originUrl);

  const responseHeaders: Record<string, string> = {
    'Content-Type': result.contentType,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Access-Control-Allow-Origin': '*',
  };

  const isBinary = !result.contentType.includes('json');
  return {
    statusCode: result.statusCode,
    headers: responseHeaders,
    body: isBinary
      ? result.bodyBuffer.toString('base64')
      : result.bodyBuffer.toString('utf-8'),
    isBase64Encoded: isBinary,
  };
};
