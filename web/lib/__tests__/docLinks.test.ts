import { describe, it, expect } from "vitest";
import { docName } from "../docLinks";

describe("docName", () => {
  it("strips path and extension", () => {
    expect(
      docName("https://github.com/dajcs/cv/blob/main/archive/2026-07-12_x/cv_unilu_dr_mlsec.pdf"),
    ).toBe("cv_unilu_dr_mlsec");
  });

  it("handles other extensions", () => {
    expect(docName("https://example.com/a/cover_y.tex")).toBe("cover_y");
  });

  it("returns the bare segment when there is no extension", () => {
    expect(docName("https://example.com/a/readme")).toBe("readme");
  });
});
