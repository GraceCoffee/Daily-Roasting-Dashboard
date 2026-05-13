import { createHmac, randomBytes } from "node:crypto";
import type { RestletResponse } from "./calc";

type NetSuiteConfig = {
  accountId: string;
  consumerKey: string;
  consumerSecret: string;
  tokenId: string;
  tokenSecret: string;
  scriptId: string;
  deployId: string;
};

const REQUEST_TIMEOUT_MS = 30_000;

function readConfig(): NetSuiteConfig {
  const required = [
    "NETSUITE_ACCOUNT_ID",
    "NETSUITE_CONSUMER_KEY",
    "NETSUITE_CONSUMER_SECRET",
    "NETSUITE_TOKEN_ID",
    "NETSUITE_TOKEN_SECRET",
    "NETSUITE_SCRIPT_ID",
    "NETSUITE_DEPLOY_ID",
  ] as const;
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `NetSuite env vars missing: ${missing.join(", ")}. Locally: \`vercel env pull .env\`. On Vercel: set in Project Settings → Environment Variables.`,
    );
  }
  return {
    accountId: process.env.NETSUITE_ACCOUNT_ID!,
    consumerKey: process.env.NETSUITE_CONSUMER_KEY!,
    consumerSecret: process.env.NETSUITE_CONSUMER_SECRET!,
    tokenId: process.env.NETSUITE_TOKEN_ID!,
    tokenSecret: process.env.NETSUITE_TOKEN_SECRET!,
    scriptId: process.env.NETSUITE_SCRIPT_ID!,
    deployId: process.env.NETSUITE_DEPLOY_ID!,
  };
}

function rfc3986Encode(s: string): string {
  return encodeURIComponent(s).replace(
    /[!*'()]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

function signGetRequest(
  cfg: NetSuiteConfig,
  savedSearchId: string,
): { url: string; authHeader: string } {
  const host = `${cfg.accountId}.restlets.api.netsuite.com`;
  const baseUrl = `https://${host}/app/site/hosting/restlet.nl`;
  const queryParams: Record<string, string> = {
    script: cfg.scriptId,
    deploy: cfg.deployId,
    savedSearchId,
  };
  const oauth: Record<string, string> = {
    oauth_consumer_key: cfg.consumerKey,
    oauth_token: cfg.tokenId,
    oauth_signature_method: "HMAC-SHA256",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_version: "1.0",
  };

  const allParams = { ...queryParams, ...oauth };
  const paramString = Object.entries(allParams)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${rfc3986Encode(k)}=${rfc3986Encode(v)}`)
    .join("&");
  const baseString = `GET&${rfc3986Encode(baseUrl)}&${rfc3986Encode(paramString)}`;
  const signingKey = `${rfc3986Encode(cfg.consumerSecret)}&${rfc3986Encode(cfg.tokenSecret)}`;
  oauth.oauth_signature = createHmac("sha256", signingKey)
    .update(baseString)
    .digest("base64");

  const authHeader =
    `OAuth realm="${cfg.accountId}",` +
    Object.entries(oauth)
      .map(([k, v]) => `${rfc3986Encode(k)}="${rfc3986Encode(v)}"`)
      .join(",");

  const url = `${baseUrl}?${new URLSearchParams(queryParams)}`;
  return { url, authHeader };
}

export async function fetchSavedSearch(
  savedSearchId: string,
): Promise<RestletResponse> {
  const cfg = readConfig();
  const { url, authHeader } = signGetRequest(cfg, savedSearchId);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new Error(
        `NetSuite RESTlet ${savedSearchId} timed out after ${REQUEST_TIMEOUT_MS}ms`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `NetSuite RESTlet ${savedSearchId} HTTP ${res.status}: ${text.slice(0, 500)}`,
    );
  }
  try {
    return JSON.parse(text) as RestletResponse;
  } catch {
    throw new Error(
      `NetSuite RESTlet ${savedSearchId} returned non-JSON body (first 500 chars): ${text.slice(0, 500)}`,
    );
  }
}

export const SAVED_SEARCH_IDS = {
  roast: "3062",
  pack: "3083",
  inventory: "3084",
} as const;
