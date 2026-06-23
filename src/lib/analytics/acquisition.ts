/**
 * Acquisition parsing — pure helpers shared by the track API (write side) and
 * the admin source report (read side). No DB / framework imports so they stay
 * trivially unit-testable and reusable from a future Android backend.
 */

/** Coarse acquisition channel for the traffic-source report. */
export type TrafficSource = "Direct" | "Search" | "Social" | "Referral" | "Campaign";

/** Defensive caps so a crafted referrer/landing URL can't bloat a stored row. */
const MAX_HOST_LENGTH = 255;
const MAX_UTM_LENGTH = 128;

/** Known search-engine hosts (suffix match on the registrable-ish host). */
const SEARCH_HOSTS = [
  "google.",
  "bing.",
  "yahoo.",
  "duckduckgo.",
  "yandex.",
  "baidu.",
  "ecosia.",
  "brave.",
];

/** Known social hosts (suffix/substring match). */
const SOCIAL_HOSTS = [
  "instagram.",
  "t.me",
  "telegram.",
  "twitter.",
  "x.com",
  "facebook.",
  "fb.com",
  "linkedin.",
  "pinterest.",
  "youtube.",
  "youtu.be",
  "reddit.",
  "aparat.",
];

/**
 * Extracts the lowercased host from a URL. Returns null for empty/malformed
 * input — callers treat a null host as "no referrer" (Direct).
 */
export function referrerHost(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
    if (!host) return null;
    return host.slice(0, MAX_HOST_LENGTH);
  } catch {
    return null;
  }
}

/** Truncate + trim a UTM value; null for empty. Never throws. */
function cleanUtm(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_UTM_LENGTH);
}

export type Utm = {
  source?: string;
  medium?: string;
  campaign?: string;
};

/**
 * Parses utm_source / utm_medium / utm_campaign from a landing URL (absolute or
 * path+query). Returns `null` when none are present, so callers can store
 * `metadata.utm` only when there is something to store. Malformed URLs yield
 * null rather than throwing.
 */
export function parseUtm(landingUrl: string | null | undefined): Utm | null {
  if (!landingUrl) return null;

  let params: URLSearchParams;
  try {
    // Tolerate both absolute URLs and bare path+query strings.
    params = new URL(landingUrl, "http://localhost").searchParams;
  } catch {
    return null;
  }

  const source = cleanUtm(params.get("utm_source"));
  const medium = cleanUtm(params.get("utm_medium"));
  const campaign = cleanUtm(params.get("utm_campaign"));

  if (!source && !medium && !campaign) return null;

  const utm: Utm = {};
  if (source) utm.source = source;
  if (medium) utm.medium = medium;
  if (campaign) utm.campaign = campaign;
  return utm;
}

/**
 * Classifies a session's landing into a coarse acquisition channel from its
 * referrer host and any UTM source. Campaign (explicit UTM) wins, then a
 * recognised search/social host, then any other referrer (Referral), else
 * Direct.
 */
export function classifyTrafficSource(
  host: string | null | undefined,
  utmSource: string | null | undefined,
): TrafficSource {
  if (utmSource && utmSource.trim()) return "Campaign";
  if (!host) return "Direct";

  const h = host.toLowerCase();
  if (SEARCH_HOSTS.some((s) => h.startsWith(s) || h.includes(`.${s}`))) return "Search";
  if (SOCIAL_HOSTS.some((s) => h === s || h.startsWith(s) || h.includes(`.${s}`))) return "Social";
  return "Referral";
}
