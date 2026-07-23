import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../llm", () => ({ chatJson: vi.fn() }));

import { chatJson } from "../llm";
import { normalizeOffer, extractOffersFromEmail, extractOfferFromPdf } from "../extract";

const chatJsonMock = vi.mocked(chatJson);

describe("extractOffersFromEmail", () => {
  beforeEach(() => chatJsonMock.mockReset());

  it("returns null when the model call fails", async () => {
    chatJsonMock.mockResolvedValue(null);
    expect(await extractOffersFromEmail("s", "f", "b")).toBeNull();
  });

  it("returns [] when the model finds no offers", async () => {
    chatJsonMock.mockResolvedValue({ offers: [] });
    expect(await extractOffersFromEmail("s", "f", "b")).toEqual([]);
  });

  it("normalizes offers and drops invalid ones", async () => {
    chatJsonMock.mockResolvedValue({
      offers: [{ title: "Dev", employer: " ESA " }, { location: "junk only" }],
    });
    const offers = await extractOffersFromEmail("s", "f", "b");
    expect(offers).toHaveLength(1);
    expect(offers?.[0]).toMatchObject({ title: "Dev", employer: "ESA" });
  });
});

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

describe("extractOfferFromPdf", () => {
  beforeEach(() => chatJsonMock.mockReset());

  it("returns null when the model call fails", async () => {
    chatJsonMock.mockResolvedValue(null);
    expect(await extractOfferFromPdf("QUJD")).toBeNull();
  });

  it("passes the PDF as an inline file part and normalizes the offer", async () => {
    chatJsonMock.mockResolvedValue({ title: "Dev", employer: " ESA " });
    const offer = await extractOfferFromPdf("QUJD");
    expect(offer).toMatchObject({ title: "Dev", employer: "ESA" });
    expect(chatJsonMock.mock.calls[0][2]).toEqual({
      mimeType: "application/pdf",
      base64: "QUJD",
    });
  });

  it("fills the link when the extracted offer has none", async () => {
    chatJsonMock.mockResolvedValue({ title: "Dev" });
    const offer = await extractOfferFromPdf("QUJD", "https://example.com/job");
    expect(offer?.link).toBe("https://example.com/job");
  });
});
