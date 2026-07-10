import { describe, it, expect } from "vitest";
import { htmlToPostingText, stripConsentLines } from "../fetchPosting";

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
