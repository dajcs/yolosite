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

async function fetchDirect(url: string): Promise<string | null> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
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
  return (await fetchDirect(url)) ?? (await fetchViaJina(url));
}
