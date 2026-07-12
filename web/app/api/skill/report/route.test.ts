import { describe, it, expect, beforeEach, vi } from "vitest";

const updates: unknown[][] = [];
let updateResult: { id: number }[] = [{ id: 1 }];

vi.mock("@/lib/guard", () => ({ skillOk: () => true }));
vi.mock("@/lib/db", () => ({
  db: () => (_strings: TemplateStringsArray, ...values: unknown[]) => {
    updates.push(values);
    return Promise.resolve(updateResult);
  },
}));

import { POST } from "./route";

function request(body: unknown) {
  return new Request("http://test/api/skill/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/skill/report", () => {
  beforeEach(() => {
    updates.length = 0;
    updateResult = [{ id: 1 }];
  });

  it("accepts the new payload and stores both URLs", async () => {
    const res = await POST(
      request({
        application_id: 1,
        archive_path: "archive/2026-07-12_acme",
        cv_url: "https://github.com/x/cv/blob/main/archive/2026-07-12_acme/cv.pdf",
        letter_url: "https://github.com/x/cv/blob/main/archive/2026-07-12_acme/letter.pdf",
      }),
    );
    expect(res.status).toBe(200);
    expect(updates[0]).toContain(
      "https://github.com/x/cv/blob/main/archive/2026-07-12_acme/cv.pdf",
    );
    expect(updates[0]).toContain(
      "https://github.com/x/cv/blob/main/archive/2026-07-12_acme/letter.pdf",
    );
  });

  it("rejects the old zip payload with 400", async () => {
    const res = await POST(
      request({
        application_id: 1,
        archive_path: "archive/x",
        zip_filename: "x.zip",
        zip_base64: "AAAA",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown application", async () => {
    updateResult = [];
    const res = await POST(
      request({ application_id: 999, archive_path: "a", cv_url: "u", letter_url: "v" }),
    );
    expect(res.status).toBe(404);
  });
});
