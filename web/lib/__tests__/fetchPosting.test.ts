import { describe, it, expect } from "vitest";
import { htmlToPostingText } from "../fetchPosting";

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
