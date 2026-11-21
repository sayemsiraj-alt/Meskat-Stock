import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFirebaseRuntimeConfigJson,
  buildNetlifyEnvSnippet,
  decodeFirebaseShareParam,
  encodeFirebaseShareParam,
  extractFirebaseConfigFromInput,
  mapFirebaseAuthErrorMessage,
  normalizeAuthDomain,
  parseFirebaseConfigSnippet,
  parseRuntimeFirebaseConfigJson,
  readEnvFirebaseConfig,
} from './firebaseConfigHelpers.ts';

test('normalizeAuthDomain strips protocols/slashes and defaults to projectId.firebaseapp.com', () => {
  assert.equal(
    normalizeAuthDomain('https://my-app.firebaseapp.com/', 'my-app'),
    'my-app.firebaseapp.com'
  );
  assert.equal(normalizeAuthDomain('', 'stock-erp'), 'stock-erp.firebaseapp.com');
});

test('encodeFirebaseShareParam and decodeFirebaseShareParam round-trip full URLs and tokens safely', () => {
  const encoded = encodeFirebaseShareParam({
    firebaseApiKey: 'AIzaTestKey123',
    firebaseProjectId: 'stock-prod-123',
    firebaseAuthDomain: 'stock-prod-123.firebaseapp.com',
    firebaseStorageBucket: 'stock-prod-123.appspot.com',
    firebaseMessagingSenderId: '987654',
    firebaseAppId: '1:987654:web:abcdef',
  });

  assert.ok(encoded.length > 10);
  const decodedFromQuery = decodeFirebaseShareParam(`?fb=${encoded}`);
  assert.equal(decodedFromQuery?.firebaseProjectId, 'stock-prod-123');

  const decodedFromHash = decodeFirebaseShareParam(`https://client-erp.netlify.app/#fb=${encoded}`);
  assert.equal(decodedFromHash?.firebaseProjectId, 'stock-prod-123');

  const decodedFromFullUrl = decodeFirebaseShareParam(
    `https://client-erp.netlify.app/?fb=${encoded}`
  );
  assert.equal(decodedFromFullUrl?.firebaseApiKey, 'AIzaTestKey123');
  assert.equal(decodedFromFullUrl?.firebaseConnected, true);
});

test('parseFirebaseConfigSnippet and extractFirebaseConfigFromInput parse JS/JSON snippets and share codes', () => {
  const jsSnippet = `const firebaseConfig = {
    apiKey: "AIzaClientKey99",
    authDomain: "client-shop.firebaseapp.com",
    projectId: "client-shop",
    storageBucket: "client-shop.appspot.com",
    messagingSenderId: "555111",
    appId: "1:555111:web:xyz"
  };`;
  const parsed = parseFirebaseConfigSnippet(jsSnippet);
  assert.equal(parsed?.firebaseApiKey, 'AIzaClientKey99');
  assert.equal(parsed?.firebaseProjectId, 'client-shop');

  const jsonParsed = extractFirebaseConfigFromInput(
    '{"apiKey": "AIzaJsonKey", "projectId": "json-proj"}'
  );
  assert.equal(jsonParsed?.firebaseApiKey, 'AIzaJsonKey');
  assert.equal(jsonParsed?.firebaseAuthDomain, 'json-proj.firebaseapp.com');
  assert.equal(jsonParsed?.firebaseConnected, true);
});

test('readEnvFirebaseConfig activates firebaseConnected only when env vars are supplied', () => {
  const cfg = readEnvFirebaseConfig({
    VITE_FIREBASE_API_KEY: 'AIzaEnvKey',
    VITE_FIREBASE_PROJECT_ID: 'env-proj',
  });
  assert.equal(cfg.firebaseConnected, true);
  assert.equal(cfg.firebaseAuthDomain, 'env-proj.firebaseapp.com');
  assert.deepEqual(readEnvFirebaseConfig({}), {});
});

test('parseRuntimeFirebaseConfigJson, buildNetlifyEnvSnippet, and buildFirebaseRuntimeConfigJson work cleanly', () => {
  const settingsLike = {
    firebaseApiKey: 'AIzaRuntime123',
    firebaseProjectId: 'meskat-erp',
    firebaseAuthDomain: 'meskat-erp.firebaseapp.com',
    firebaseStorageBucket: 'meskat-erp.appspot.com',
    firebaseMessagingSenderId: '12345',
    firebaseAppId: '1:12345:web:abc',
  };

  const jsonStr = buildFirebaseRuntimeConfigJson(settingsLike);
  const parsed = parseRuntimeFirebaseConfigJson(JSON.parse(jsonStr));
  assert.equal(parsed?.firebaseApiKey, 'AIzaRuntime123');
  assert.equal(parsed?.firebaseProjectId, 'meskat-erp');
  assert.equal(parsed?.firebaseConnected, true);

  assert.equal(parseRuntimeFirebaseConfigJson({ foo: 'bar' }), null);

  const envText = buildNetlifyEnvSnippet(settingsLike);
  assert.match(envText, /VITE_FIREBASE_API_KEY=AIzaRuntime123/);
  assert.match(envText, /VITE_FIREBASE_PROJECT_ID=meskat-erp/);
});

test('mapFirebaseAuthErrorMessage identifies unauthorized-domain and popup-blocked redirect fallback', () => {
  const domainErr = mapFirebaseAuthErrorMessage(
    'auth/unauthorized-domain',
    '',
    'dearhealth.netlify.app'
  );
  assert.equal(domainErr.shouldFallbackToRedirect, false);
  assert.match(domainErr.message, /dearhealth\.netlify\.app/);
  assert.match(domainErr.message, /Authorized domains/i);

  const popupErr = mapFirebaseAuthErrorMessage(
    'auth/popup-blocked',
    '',
    'dearhealth.netlify.app'
  );
  assert.equal(popupErr.shouldFallbackToRedirect, true);
});
