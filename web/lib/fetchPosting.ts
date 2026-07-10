import { convert } from "html-to-text";

const CONSENT_LINE = /\b(cookies?|consent)\b/i;

export function stripConsentLines(text: string): string {
  return text
    .split("\n")
    .filter((line) => !CONSENT_LINE.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function htmlToPostingText(html: string): string {
  const text = convert(html, {
    wordwrap: false,
    selectors: [
      { selector: "a", options: { ignoreHref: true } },
      { selector: "img", format: "skip" },
      { selector: "nav", format: "skip" },
      { selector: "footer", format: "skip" },
      { selector: "script", format: "skip" },
      { selector: "style", format: "skip" },
      // Common consent-manager containers.
      { selector: "#onetrust-consent-sdk", format: "skip" },
      { selector: "#CybotCookiebotDialog", format: "skip" },
      { selector: "#cookie-banner", format: "skip" },
      { selector: ".cookie-banner", format: "skip" },
      { selector: ".cc-window", format: "skip" },
    ],
  });
  return stripConsentLines(text);
}

const MIN_LENGTH = 300;
const MAX_LENGTH = 30_000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

// LinkedIn email links (/comm/jobs/view/{id}/…) and canonical /jobs/view/{id}
// links both force a login wall. LinkedIn's public guest endpoint returns the
// full job description with no auth, so we map job links to it.
const LINKEDIN_JOB = /linkedin\.com\/.*?(?:jobs\/view\/|currentJobId=)(\d+)/i;

export function linkedInGuestUrl(url: string): string | null {
  const match = url.match(LINKEDIN_JOB);
  return match
    ? `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${match[1]}`
    : null;
}

async function fetchLinkedInGuest(url: string): Promise<string | null> {
  const guest = linkedInGuestUrl(url);
  if (!guest) return null;
  let response: Response;
  try {
    response = await fetch(guest, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;

  // The description lives in the single description__text container; slice from
  // just after its opening tag so the surrounding sign-in chrome is dropped.
  const html = await response.text();
  const marker = html.indexOf("description__text");
  if (marker === -1) return null;
  const start = html.indexOf(">", marker) + 1;
  const text = htmlToPostingText(html.slice(start));
  return text.length >= MIN_LENGTH ? text.slice(0, MAX_LENGTH) : null;
}

async function fetchDirect(url: string): Promise<string | null> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("html") && !contentType.includes("text")) {
    return null;
  }

  const text = htmlToPostingText(await response.text());
  // Login walls and bot blocks typically produce short pages.
  return text.length >= MIN_LENGTH ? text.slice(0, MAX_LENGTH) : null;
}

async function fetchViaJina(url: string): Promise<string | null> {
  let response: Response;
  try {
    response = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        Accept: "text/plain",
        ...(process.env.JINA_API_KEY
          ? { Authorization: `Bearer ${process.env.JINA_API_KEY}` }
          : {}),
      },
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;

  const text = stripConsentLines((await response.text()).trim());
  return text.length >= MIN_LENGTH ? text.slice(0, MAX_LENGTH) : null;
}

export async function fetchPostingText(url: string): Promise<string | null> {
  return (
    (await fetchLinkedInGuest(url)) ??
    (await fetchDirect(url)) ??
    (await fetchViaJina(url))
  );
}
