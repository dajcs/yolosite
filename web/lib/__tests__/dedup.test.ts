import { describe, it, expect } from "vitest";
import {
  candidateKey,
  employerMatches,
  pickDuplicate,
  formatDuplicate,
  type AppRow,
  type OfferRow,
} from "../dedup";

describe("employerMatches", () => {
  it("matches case-insensitively", () => {
    expect(employerMatches("Amazon", "amazon")).toBe(true);
  });
  it("matches when one name contains the other", () => {
    expect(employerMatches("Amazon", "Amazon Web Services")).toBe(true);
    expect(employerMatches("Amazon Web Services", "amazon")).toBe(true);
  });
  it("rejects different employers", () => {
    expect(employerMatches("Amazon", "Google")).toBe(false);
  });
  it("is conservative on missing names", () => {
    expect(employerMatches(null, "Amazon")).toBe(false);
    expect(employerMatches("Amazon", "")).toBe(false);
    expect(employerMatches(null, null)).toBe(false);
  });
});

describe("candidateKey", () => {
  it("cleans the link", () => {
    const key = candidateKey({
      link: "https://www.linkedin.com/comm/jobs/view/123/?trackingId=x&trk=eml",
    });
    expect(key?.link).toBe("https://www.linkedin.com/jobs/view/123");
  });
  it("returns null when there is neither link nor ref_id", () => {
    expect(candidateKey({ employer: "Acme" })).toBeNull();
    expect(candidateKey({ ref_id: "  " })).toBeNull();
  });
  it("trims ref and employer", () => {
    const key = candidateKey({ ref_id: " R-1 ", employer: " Acme " });
    expect(key).toEqual({ link: null, ref: "R-1", employer: "Acme" });
  });
});

const row = {
  employer: "Acme",
  title: "Engineer",
  ref_id: "R-1",
  link: "https://acme.com/jobs/1",
};
const appRow: AppRow = { ...row, date: "2026-06-01" };
const dismissedRow: OfferRow = {
  ...row,
  dismissed: true,
  dismissed_date: "2026-06-02",
};
const activeRow: OfferRow = { ...row, dismissed: false, dismissed_date: null };

describe("pickDuplicate", () => {
  const byLink = candidateKey({ link: "https://acme.com/jobs/1" })!;
  const byRef = candidateKey({ ref_id: "r-1", employer: "ACME Corp" })!;

  it("matches by link regardless of employer/ref", () => {
    expect(pickDuplicate(byLink, [], [activeRow])?.status).toBe("active");
  });
  it("matches by ref + fuzzy employer when links differ", () => {
    expect(pickDuplicate(byRef, [], [dismissedRow])?.status).toBe("dismissed");
  });
  it("rejects ref match when employers differ", () => {
    const key = candidateKey({ ref_id: "R-1", employer: "Google" })!;
    expect(pickDuplicate(key, [], [dismissedRow])).toBeNull();
  });
  it("rejects ref match when candidate employer is missing", () => {
    const key = candidateKey({ ref_id: "R-1" })!;
    expect(pickDuplicate(key, [], [dismissedRow])).toBeNull();
  });
  it("prefers applied over dismissed over active", () => {
    const applied = pickDuplicate(byLink, [appRow], [dismissedRow, activeRow]);
    expect(applied?.status).toBe("applied");
    expect(applied?.date).toBe("2026-06-01");
    const dismissed = pickDuplicate(byLink, [], [activeRow, dismissedRow]);
    expect(dismissed?.status).toBe("dismissed");
    expect(dismissed?.date).toBe("2026-06-02");
  });
  it("returns null when nothing matches", () => {
    const key = candidateKey({ link: "https://other.com/j/9" })!;
    expect(pickDuplicate(key, [appRow], [dismissedRow, activeRow])).toBeNull();
  });
});

describe("formatDuplicate", () => {
  it("formats applied / dismissed / active", () => {
    expect(
      formatDuplicate({ ...row, status: "applied", date: "2026-06-01" }),
    ).toBe("Acme — Engineer (R-1) — APPLIED on 2026-06-01");
    expect(
      formatDuplicate({ ...row, status: "dismissed", date: "2026-06-02" }),
    ).toBe("Acme — Engineer (R-1) — DISMISSED on 2026-06-02");
    expect(formatDuplicate({ ...row, status: "active", date: null })).toBe(
      "Acme — Engineer (R-1) — ALREADY IN OFFERS",
    );
  });
  it("handles missing fields", () => {
    expect(
      formatDuplicate({
        status: "active",
        date: null,
        employer: null,
        title: "Engineer",
        ref_id: null,
        link: null,
      }),
    ).toBe("Engineer — ALREADY IN OFFERS");
  });
});
