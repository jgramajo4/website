const BEAR_BLOG_RSS_URL = "https://0xgramajo.xyz/feed/";
const DEFAULT_LIMIT = 10;

export type BearBlogPost = {
	title: string;
	url: string;
	published: Date;
	publishedIso: string;
};

let cachedFeed: BearBlogPost[] | null = null;

/**
 * Fetches the Bear Blog RSS feed and returns a list of posts sorted by publish date (desc).
 * The result is cached in-memory for subsequent calls within the same build/runtime.
 *
 * @param limit - Optional maximum number of posts to return (defaults to 10).
 */
export async function fetchBearBlogFeed(limit: number = DEFAULT_LIMIT): Promise<BearBlogPost[]> {
	if (cachedFeed) {
		return cachedFeed.slice(0, limit);
	}

	const response = await fetch(BEAR_BLOG_RSS_URL, {
		headers: {
			Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
		},
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch RSS feed: ${response.status} ${response.statusText}`);
	}

	const xml = await response.text();
	const posts = parsePostsFromXml(xml);

	const sorted = posts.sort(
		(a, b) => b.published.getTime() - a.published.getTime(),
	);

	cachedFeed = sorted;

	return sorted.slice(0, limit);
}

function parsePostsFromXml(xml: string): BearBlogPost[] {
	const itemMatches = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/gi));

	return itemMatches
		.map((match) => match[1] ?? "")
		.map((fragment) => {
			const rawTitle = extractTagValue(fragment, "title");
			const rawLink = extractTagValue(fragment, "link");
			const rawPubDate = extractTagValue(fragment, "pubDate");

			if (!rawTitle || !rawLink || !rawPubDate) {
				return null;
			}

			const published = parseRssDate(rawPubDate);
			if (!published) {
				return null;
			}

			return {
				title: rawTitle,
				url: rawLink,
				published,
				publishedIso: published.toISOString(),
			} satisfies BearBlogPost;
		})
		.filter((post): post is BearBlogPost => Boolean(post));
}

function extractTagValue(fragment: string, tag: string): string | null {
	const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i");
	const match = fragment.match(regex);
	if (!match?.[1]) {
		return null;
	}

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
		.replace(/&quot;/g, "\"")
		.replace(/&#39;/g, "'");
}

function parseRssDate(value: string): Date | null {
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}
