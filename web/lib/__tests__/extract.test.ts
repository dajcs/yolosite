import { describe, it, expect } from "vitest";
import { normalizeOffer } from "../extract";

describe("normalizeOffer", () => {
  it("keeps valid string fields and trims them", () => {
    const offer = normalizeOffer({
      employer: "  ESA ",
      title: "AI Engineer",
      location: "Luxembourg",
      ref_id: "REF-1",
      deadline: "2026-08-01",
      requirements: "Python, ML",
      link: "https://example.com/job",
    });
    expect(offer).toEqual({
      employer: "ESA",
      title: "AI Engineer",
      location: "Luxembourg",
      ref_id: "REF-1",
      deadline: "2026-08-01",
      requirements: "Python, ML",
      link: "https://example.com/job",
    });
  });

  it("coerces missing, empty, and non-string fields to null", () => {
    const offer = normalizeOffer({ title: "Dev", employer: 42, link: "" });
    expect(offer).toEqual({
      employer: null,
      title: "Dev",
      location: null,
      ref_id: null,
      deadline: null,
      requirements: null,
      link: null,
    });
  });

  it("returns null when both employer and title are missing", () => {
    expect(normalizeOffer({ location: "Paris" })).toBeNull();
  });

  it("returns null for non-objects", () => {
    expect(normalizeOffer("job")).toBeNull();
    expect(normalizeOffer(null)).toBeNull();
  });
});
