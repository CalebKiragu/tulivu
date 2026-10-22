import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export interface UrlCheckResult {
  url: string;
  syntaxValid: boolean;
  reachable: boolean | null;
  httpStatus: number | null;
  checkedAt: string;
  note: string;
}

const BLOCKED_HOSTNAMES = new Set(["localhost", "metadata.google.internal", "metadata"]);
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 6_000;

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateIpv6(address: string): boolean {
  const normalised = address.toLowerCase();
  if (normalised === "::1" || normalised === "::") return true;
  if (normalised.startsWith("fc") || normalised.startsWith("fd")) return true;
  if (normalised.startsWith("fe8") || normalised.startsWith("fe9") || normalised.startsWith("fea") || normalised.startsWith("feb")) {
    return true;
  }
  if (normalised.startsWith("::ffff:")) {
    const mapped = normalised.replace("::ffff:", "");
    return isIP(mapped) === 4 ? isPrivateIpv4(mapped) : true;
  }
  return false;
}

export async function assertPublicHttpUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Enter a valid absolute URL, including https://");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only http and https URLs can be checked.");
  }
  if (url.username || url.password) {
    throw new Error("URLs containing credentials are not allowed.");
  }
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new Error("Local and internal hosts cannot be checked.");
  }
  if (isIP(hostname)) {
    if (isIP(hostname) === 4 ? isPrivateIpv4(hostname) : isPrivateIpv6(hostname)) {
      throw new Error("Private and link-local addresses cannot be checked.");
    }
    return url;
  }
  const records = await lookup(hostname, { all: true, verbatim: true });
  if (!records.length) throw new Error("The hostname did not resolve.");
  if (records.some((record) => (record.family === 4 ? isPrivateIpv4(record.address) : isPrivateIpv6(record.address)))) {
    throw new Error("The hostname resolves to a private or link-local address.");
  }
  return url;
}

async function fetchOnce(url: URL): Promise<Response> {
  return fetch(url, {
    method: "GET",
    redirect: "manual",
    headers: { "user-agent": "TulivuConversionCheck/0.1 (+https://tulivu.demo)" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

/**
 * SSRF-aware reachability check. DNS is resolved and private ranges are
 * rejected before the request. Redirects are followed manually and rechecked.
 */
export async function checkDestinationUrl(raw: string): Promise<UrlCheckResult> {
  const checkedAt = new Date().toISOString();
  if (!raw.trim()) {
    return {
      url: raw,
      syntaxValid: false,
      reachable: null,
      httpStatus: null,
      checkedAt,
      note: "No destination URL was supplied.",
    };
  }

  // Syntax validity and reachability are separate facts. A valid URL whose DNS
  // record does not resolve is still syntactically valid; it has simply not
  // been verified. Conflating the two would block approval for the wrong reason.
  try {
    const parsed = new URL(raw);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Only http and https URLs can be checked.");
    }
    if (parsed.username || parsed.password) {
      throw new Error("URLs containing credentials are not allowed.");
    }
  } catch (error) {
    return {
      url: raw,
      syntaxValid: false,
      reachable: null,
      httpStatus: null,
      checkedAt,
      note: (error as Error).message,
    };
  }

  let current: URL;
  try {
    current = await assertPublicHttpUrl(raw);
  } catch (error) {
    return {
      url: raw,
      syntaxValid: true,
      reachable: null,
      httpStatus: null,
      checkedAt,
      note: `${(error as Error).message} The URL syntax is valid, so reachability is recorded as unverified rather than invalid.`,
    };
  }

  try {
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
      const response = await fetchOnce(current);
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location) {
          return {
            url: raw,
            syntaxValid: true,
            reachable: false,
            httpStatus: response.status,
            checkedAt,
            note: "The destination redirected without a Location header.",
          };
        }
        current = await assertPublicHttpUrl(new URL(location, current).toString());
        continue;
      }
      await response.body?.cancel();
      return {
        url: raw,
        syntaxValid: true,
        reachable: response.status < 500,
        httpStatus: response.status,
        checkedAt,
        note:
          response.status >= 400
            ? `The destination responded with HTTP ${response.status}. The landing page may be missing or protected.`
            : `The destination responded with HTTP ${response.status}. Response content was not analysed.`,
      };
    }
    return {
      url: raw,
      syntaxValid: true,
      reachable: null,
      httpStatus: null,
      checkedAt,
      note: "Too many redirects; reachability could not be confirmed.",
    };
  } catch (error) {
    const message =
      error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
        ? "The reachability check timed out. This is not proof that the page is down."
        : `The destination could not be reached from the server (${(error as Error).message.slice(0, 120)}). This is not proof that it is down for customers.`;
    return {
      url: raw,
      syntaxValid: true,
      reachable: false,
      httpStatus: null,
      checkedAt,
      note: message,
    };
  }
}
