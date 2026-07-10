import { describe, it, expect } from "vitest";
import {
  htmlToPostingText,
  stripConsentLines,
  linkedInGuestUrl,
  cleanUrl,
} from "../fetchPosting";

describe("cleanUrl", () => {
  it("canonicalizes LinkedIn job links (drops all tracking)", () => {
    expect(
      cleanUrl(
        "https://www.linkedin.com/comm/jobs/view/4412022121/?trackingId=x&otpToken=SECRET&trk=eml",
      ),
    ).toBe("https://www.linkedin.com/jobs/view/4412022121");
  });

  it("strips known tracking params but keeps meaningful ones", () => {
    const cleaned = cleanUrl(
      "http://careers.ses.com/job/Chennai-Engineer%2C-Service-Monitoring/1381125433/?from=email&refid=26318715101&utm_source=J2WEmail&source=2&eid=45401&locale=en_GB",
    );
    expect(cleaned).not.toMatch(/utm_source|refid|from=|source=|eid=/);
    expect(cleaned).toContain("1381125433");
    expect(cleaned).toContain("locale=en_GB");
  });

  it("canonicalizes Glassdoor job-listing links to path + jl", () => {
    const long =
      "https://www.glassdoor.fr/job-listing/postdoc-ai-universit%C3%A9-du-luxembourg-JV_IC2941924_KO0,55_KE56,80.htm?jl=1010192499322&tgt=GD_JOB_VIEW&src=GD_JOB_AD&s=224&t=JA&ja=271220987&jobListingId=1010192499322&cb=1783535405773";
    const expected =
      "https://www.glassdoor.fr/job-listing/postdoc-ai-universit%C3%A9-du-luxembourg-JV_IC2941924_KO0,55_KE56,80.htm?jl=1010192499322";
    expect(cleanUrl(long)).toBe(expected);
    expect(cleanUrl(expected)).toBe(expected); // idempotent
  });

  it("keeps essential job-id query params", () => {
    expect(cleanUrl("https://boards.greenhouse.io/acme/jobs/123?gh_jid=456")).toBe(
      "https://boards.greenhouse.io/acme/jobs/123?gh_jid=456",
    );
  });

  it("leaves clean urls and non-urls untouched", () => {
    expect(cleanUrl("https://example.com/job/1")).toBe("https://example.com/job/1");
    expect(cleanUrl("not a url")).toBe("not a url");
  });
});

describe("linkedInGuestUrl", () => {
  const guest = (id: string) =>
    `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${id}`;

  it("maps email tracking links (/comm/jobs/view/)", () => {
    expect(
      linkedInGuestUrl(
        "https://www.linkedin.com/comm/jobs/view/4433282804/?trk=abc",
      ),
    ).toBe(guest("4433282804"));
  });

  it("maps canonical /jobs/view/ links", () => {
    expect(
      linkedInGuestUrl("https://www.linkedin.com/jobs/view/123456"),
    ).toBe(guest("123456"));
  });

  it("maps currentJobId query links", () => {
    expect(
      linkedInGuestUrl("https://www.linkedin.com/jobs/search/?currentJobId=999"),
    ).toBe(guest("999"));
  });

  it("returns null for non-job or non-linkedin urls", () => {
    expect(linkedInGuestUrl("https://www.linkedin.com/in/someone")).toBeNull();
    expect(linkedInGuestUrl("https://example.com/jobs/view/1")).toBeNull();
  });
});

describe("htmlToPostingText", () => {
  it("extracts readable text and skips nav/footer/script", () => {
    const html = `<html><body>
      <nav>Home | Jobs | About</nav>
      <h1>AI Engineer</h1>
      <p>We are hiring an <strong>AI Engineer</strong> in Luxembourg.</p>
      <script>track();</script>
      <footer>© Example Corp</footer>
    </body></html>`;
    const text = htmlToPostingText(html);
    expect(text).toContain("AI Engineer");
    expect(text).toContain("Luxembourg");
    expect(text).not.toContain("track()");
    expect(text).not.toContain("© Example Corp");
    expect(text).not.toContain("Home | Jobs");
  });

  it("collapses runs of blank lines", () => {
    const text = htmlToPostingText("<p>a</p><br/><br/><br/><br/><p>b</p>");
    expect(text).not.toMatch(/\n{3,}/);
  });
});

describe("consent cleanup", () => {
  it("drops cookie banner markup and consent lines", () => {
    const html = `<html><body>
      <div id="onetrust-consent-sdk"><p>We value your privacy</p></div>
      <h1>AI Engineer</h1>
      <p>Build ML pipelines in Luxembourg.</p>
      <p>This website uses cookies to improve your experience.</p>
      <p>By clicking Accept you consent to our use of tracking.</p>
    </body></html>`;
    const text = htmlToPostingText(html);
    expect(text).toMatch(/AI Engineer/i); // html-to-text uppercases <h1>
    expect(text).toContain("ML pipelines");
    expect(text).not.toMatch(/cookies/i);
    expect(text).not.toMatch(/consent/i);
  });

  it("stripConsentLines keeps normal lines", () => {
    const cleaned = stripConsentLines(
      "Great job\nWe use cookies here\nApply now",
    );
    expect(cleaned).toBe("Great job\nApply now");
  });
});
