#!/usr/bin/env node
/**
 * NetSuite RESTlet smoke test.
 *
 * Loads credentials from `.env` (or env vars), signs a request using TBA
 * (OAuth 1.0a + HMAC-SHA256), calls the Roasting Dashboard RESTlet, and
 * prints the response.
 *
 * Usage:  node scripts/test-restlet.mjs <savedSearchId>
 * Example: node scripts/test-restlet.mjs 3062
 */

import { readFileSync } from 'node:fs';
import { createHmac, randomBytes } from 'node:crypto';

try {
    const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
    for (const line of env.split('\n')) {
        const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
        if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, '');
    }
} catch { /* .env optional */ }

const {
    NETSUITE_ACCOUNT_ID = '6617070',
    NETSUITE_CONSUMER_KEY,
    NETSUITE_CONSUMER_SECRET,
    NETSUITE_TOKEN_ID,
    NETSUITE_TOKEN_SECRET,
    NETSUITE_SCRIPT_ID = '3855',
    NETSUITE_DEPLOY_ID = '1',
} = process.env;

const savedSearchId = process.argv[2];
if (!savedSearchId) {
    console.error('Usage: node scripts/test-restlet.mjs <savedSearchId>');
    console.error('Example: node scripts/test-restlet.mjs 3062');
    process.exit(1);
}

for (const [k, v] of Object.entries({
    NETSUITE_CONSUMER_KEY,
    NETSUITE_CONSUMER_SECRET,
    NETSUITE_TOKEN_ID,
    NETSUITE_TOKEN_SECRET,
})) {
    if (!v) {
        console.error(`Missing env var: ${k} (set it in .env or export it)`);
        process.exit(1);
    }
}

// RFC 3986-strict percent encoding (encodeURIComponent leaves !*'() un-encoded).
const enc = (s) =>
    encodeURIComponent(s).replace(/[!*'()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

const host = `${NETSUITE_ACCOUNT_ID}.restlets.api.netsuite.com`;
const baseUrl = `https://${host}/app/site/hosting/restlet.nl`;
const queryParams = {
    script: NETSUITE_SCRIPT_ID,
    deploy: NETSUITE_DEPLOY_ID,
    savedSearchId,
};

const oauth = {
    oauth_consumer_key: NETSUITE_CONSUMER_KEY,
    oauth_token: NETSUITE_TOKEN_ID,
    oauth_signature_method: 'HMAC-SHA256',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_version: '1.0',
};

const allParams = { ...queryParams, ...oauth };
const paramString = Object.entries(allParams)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${enc(k)}=${enc(v)}`)
    .join('&');
const baseString = `GET&${enc(baseUrl)}&${enc(paramString)}`;
const signingKey = `${enc(NETSUITE_CONSUMER_SECRET)}&${enc(NETSUITE_TOKEN_SECRET)}`;
oauth.oauth_signature = createHmac('sha256', signingKey).update(baseString).digest('base64');

const authHeader =
    `OAuth realm="${NETSUITE_ACCOUNT_ID}",` +
    Object.entries(oauth)
        .map(([k, v]) => `${enc(k)}="${enc(v)}"`)
        .join(',');

const url = `${baseUrl}?${new URLSearchParams(queryParams)}`;
console.log(`→ GET ${url}`);

try {
    const res = await fetch(url, {
        method: 'GET',
        headers: {
            Authorization: authHeader,
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
    });
    console.log(`← HTTP ${res.status}`);
    console.log('--- response headers ---');
    res.headers.forEach((v, k) => console.log(`  ${k}: ${v}`));
    console.log('--- response body ---');
    const text = await res.text();
    try {
        console.log(JSON.stringify(JSON.parse(text), null, 2));
    } catch {
        console.log(text);
    }
    if (!res.ok) process.exit(1);
} catch (e) {
    console.error('Fetch error:', e);
    process.exit(1);
}
