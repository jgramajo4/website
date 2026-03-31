import { request as httpsRequest } from "node:https";

const BEAR_BLOG_RSS_URL = "https://0xgramajo.xyz/feed/";
const BEAR_BLOG_FALLBACK_URL = "https://0xgramajo.xyz/blog/";
const DEFAULT_LIMIT = 10;
const REQUEST_HEADERS = {
  Accept:
    "application/atom+xml, application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
  "User-Agent":
    "Mozilla/5.0 (compatible; GramajoSiteBot/1.0; +https://gramajo.xyz)",
  "Accept-Encoding": "identity",
};
const MAX_REDIRECTS = 3;

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type BearBlogPost = {
  title: string;
  url: string;
  published: Date;
  publishedIso: string;
};

let cachedFeed: BearBlogPost[] | null = null;

export class BearBlogFeedError extends Error {
  readonly fallbackUrl = BEAR_BLOG_FALLBACK_URL;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "BearBlogFeedError";
    if (options?.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

/**
 * Fetches the Bear Blog feed (Atom or RSS) and returns posts sorted by date desc.
 * Cached in-memory for subsequent calls within the same build/runtime.
 */
export async function fetchBearBlogFeed(
  limit: number = DEFAULT_LIMIT,
): Promise<BearBlogPost[]> {
  if (cachedFeed && cachedFeed.length > 0) {
    return cachedFeed.slice(0, limit);
  }

  let xml: string;
  try {
    xml = await fetchFeedXml(BEAR_BLOG_RSS_URL);
  } catch (error) {
    if (cachedFeed && cachedFeed.length > 0) {
      console.warn("[rss] Serving cached Bear Blog feed due to fetch failure.");
      return cachedFeed.slice(0, limit);
    }
    throw error;
  }

  let posts: BearBlogPost[];
  try {
    // Detect Atom vs RSS and parse accordingly
    const isAtom = /<feed[^>]*xmlns[^>]*>/i.test(xml) || /<entry>/i.test(xml);
    posts = isAtom ? parseAtomFeed(xml) : parseRssFeed(xml);
  } catch (parseError) {
    console.error("[rss] Unable to parse Bear Blog feed.", parseError);
    throw new BearBlogFeedError(
      `Unable to read the Bear Blog feed. Visit ${BEAR_BLOG_FALLBACK_URL} for the latest posts.`,
      { cause: parseError instanceof Error ? parseError : undefined },
    );
  }

  if (posts.length === 0) {
    console.warn("[rss] Bear Blog feed responded with zero items.");
    throw new BearBlogFeedError(
      `No entries were returned from the Bear Blog feed. Visit ${BEAR_BLOG_FALLBACK_URL} for the archive.`,
    );
  }

  const sorted = posts.sort(
    (a, b) => b.published.getTime() - a.published.getTime(),
  );
  cachedFeed = sorted;
  return sorted.slice(0, limit);
}

// ── Atom parser ──────────────────────────────────────────────────────────────

function parseAtomFeed(xml: string): BearBlogPost[] {
  const entryMatches = Array.from(xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi));

  return entryMatches
    .map((match) => match[1] ?? "")
    .map((fragment) => {
      const rawTitle = extractTagValue(fragment, "title");

      // Atom uses <link href="..." rel="alternate"/> for the post URL
      const linkMatch =
        fragment.match(/<link[^>]+href="([^"]+)"[^>]*rel="alternate"/i) ??
        fragment.match(/<link[^>]+rel="alternate"[^>]+href="([^"]+)"/i) ??
        fragment.match(/<link[^>]+href="([^"]+)"/i);
      const rawLink = linkMatch?.[1] ?? null;

      // Atom uses <published> (preferred) or <updated>
      const rawDate =
        extractTagValue(fragment, "published") ??
        extractTagValue(fragment, "updated");

      if (!rawTitle || !rawLink || !rawDate) {
        return null;
      }

      const published = parseDate(rawDate);
      if (!published) return null;

      return {
        title: rawTitle,
        url: rawLink,
        published,
        publishedIso: published.toISOString(),
      } satisfies BearBlogPost;
    })
    .filter((post): post is BearBlogPost => Boolean(post));
}

// ── RSS parser ───────────────────────────────────────────────────────────────

function parseRssFeed(xml: string): BearBlogPost[] {
  const itemMatches = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/gi));

  return itemMatches
    .map((match) => match[1] ?? "")
    .map((fragment) => {
      const rawTitle = extractTagValue(fragment, "title");
      const rawLink = extractTagValue(fragment, "link");
      const rawPubDate = extractTagValue(fragment, "pubDate");

      if (!rawTitle || !rawLink || !rawPubDate) return null;

      const published = parseDate(rawPubDate);
      if (!published) return null;

      return {
        title: rawTitle,
        url: rawLink,
        published,
        publishedIso: published.toISOString(),
      } satisfies BearBlogPost;
    })
    .filter((post): post is BearBlogPost => Boolean(post));
}

// ── Shared helpers ───────────────────────────────────────────────────────────

function extractTagValue(fragment: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const match = fragment.match(regex);
  if (!match?.[1]) return null;
  return decodeXml(stripCdata(match[1]).trim());
}

function stripCdata(value: string): string {
  return value.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseDate(value: string): Date | null {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// ── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchFeedXml(url: string): Promise<string> {
  const fetcher = getPreferredFetcher();

  if (fetcher) {
    try {
      return await fetchWithAstro(fetcher, url);
    } catch (error) {
      console.error(`[rss] Primary fetch attempt failed for ${url}`, error);
    }
  } else {
    console.warn(
      "[rss] No fetch implementation detected; using HTTPS fallback.",
    );
  }

  try {
    return await fetchWithHttps(url);
  } catch (error) {
    console.error(`[rss] HTTPS fallback fetch failed for ${url}`, error);
    throw new BearBlogFeedError(
      `Unable to fetch the latest posts right now. Visit ${BEAR_BLOG_FALLBACK_URL} instead.`,
      { cause: error instanceof Error ? error : undefined },
    );
  }
}

function getPreferredFetcher(): FetchFn | null {
  const astroFetch = (
    globalThis as typeof globalThis & { Astro?: { fetch?: FetchFn } }
  ).Astro?.fetch;
  if (typeof astroFetch === "function") return astroFetch.bind(globalThis);
  return typeof globalThis.fetch === "function"
    ? globalThis.fetch.bind(globalThis)
    : null;
}

async function fetchWithAstro(fetcher: FetchFn, url: string): Promise<string> {
  const response = await fetcher(url, {
    headers: REQUEST_HEADERS,
    redirect: "follow",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      `Fetch failed with ${response.status} ${response.statusText}`,
    );
  }
  return await response.text();
}

function fetchWithHttps(url: string, redirectCount = 0): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = httpsRequest(
      url,
      { headers: REQUEST_HEADERS },
      (response) => {
        if (!response) {
          reject(new Error("No response received from HTTPS request."));
          return;
        }

        const statusCode = response.statusCode ?? 0;

        if (
          statusCode >= 300 &&
          statusCode < 400 &&
          response.headers.location
        ) {
          response.resume();
          if (redirectCount >= MAX_REDIRECTS) {
            reject(new Error("Too many redirects while fetching feed."));
            return;
          }
          const nextUrl = new URL(response.headers.location, url).toString();
          fetchWithHttps(nextUrl, redirectCount + 1)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (statusCode < 200 || statusCode >= 400) {
          response.resume();
          reject(new Error(`HTTPS request failed with status ${statusCode}`));
          return;
        }

        const chunks: string[] = [];
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          chunks.push(chunk);
        });
        response.on("end", () => {
          resolve(chunks.join(""));
        });
        response.on("error", reject);
      },
    );

    request.on("error", reject);
    request.end();
  });
}
