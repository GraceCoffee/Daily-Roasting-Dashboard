export const SESSION_COOKIE_NAME = "dashboard_session";
export const SESSION_DURATION_SECONDS = 30 * 24 * 60 * 60;

async function getHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

function base64UrlEncode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

async function hmacSign(secret: string, message: string): Promise<string> {
  const key = await getHmacKey(secret);
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  return base64UrlEncode(sig);
}

function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function createSessionToken(password: string): Promise<string> {
  const expMs = Date.now() + SESSION_DURATION_SECONDS * 1000;
  const expStr = expMs.toString();
  const sig = await hmacSign(password, expStr);
  return `${expStr}.${sig}`;
}

export async function verifySessionToken(
  token: string,
  password: string,
): Promise<boolean> {
  const dotIdx = token.indexOf(".");
  if (dotIdx === -1) return false;
  const expStr = token.slice(0, dotIdx);
  const providedSig = token.slice(dotIdx + 1);
  const exp = Number.parseInt(expStr, 10);
  if (!Number.isFinite(exp) || exp <= Date.now()) return false;
  const expectedSig = await hmacSign(password, expStr);
  return timingSafeStringEqual(providedSig, expectedSig);
}
