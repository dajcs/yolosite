import { describe, it, expect, beforeEach, vi } from "vitest";

const createOfferMock = vi.fn();
const findDuplicateMock = vi.fn();
const extractPdfMock = vi.fn();

vi.mock("@/lib/guard", () => ({ sessionOk: () => Promise.resolve(true) }));
vi.mock("@/lib/offers", () => ({
  listOffers: vi.fn(),
  createOffer: (...a: unknown[]) => createOfferMock(...a),
  findDuplicate: (...a: unknown[]) => findDuplicateMock(...a),
}));
vi.mock("@/lib/extract", () => ({
  extractOfferFromText: vi.fn(),
  extractOfferFromPdf: (...a: unknown[]) => extractPdfMock(...a),
}));
vi.mock("@/lib/fetchPosting", () => ({ fetchPostingText: vi.fn() }));

import { POST } from "./route";

function request(body: unknown) {
  return new Request("http://test/api/assistant/offers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/assistant/offers — pdf branch", () => {
  beforeEach(() => {
    createOfferMock.mockReset().mockResolvedValue(7);
    findDuplicateMock.mockReset().mockResolvedValue(null);
    extractPdfMock.mockReset();
  });

  it("extracts from the pdf and stores the transcribed posting text", async () => {
    extractPdfMock.mockResolvedValue({
      offer: { title: "Dev", employer: "ESA", link: null },
      text: "Full posting body.",
    });
    const res = await POST(request({ pdf: "QUJD" }));
    expect(res.status).toBe(201);
    expect(extractPdfMock).toHaveBeenCalledWith("QUJD", undefined);
    expect(createOfferMock).toHaveBeenCalledWith(
      { title: "Dev", employer: "ESA", link: null },
      { source: "manual", posting_text: "Full posting body.", link: null },
    );
  });

  it("returns 422 when extraction fails", async () => {
    extractPdfMock.mockResolvedValue(null);
    const res = await POST(request({ pdf: "QUJD" }));
    expect(res.status).toBe(422);
    expect(createOfferMock).not.toHaveBeenCalled();
  });

  it("returns 409 on a duplicate", async () => {
    extractPdfMock.mockResolvedValue({
      offer: { title: "Dev", employer: "ESA", link: null },
      text: "Full posting body.",
    });
    findDuplicateMock.mockResolvedValue({ link: "https://x", offerId: 1 });
    const res = await POST(request({ pdf: "QUJD" }));
    expect(res.status).toBe(409);
    expect(createOfferMock).not.toHaveBeenCalled();
  });
});
