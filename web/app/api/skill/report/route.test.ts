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

const validBody = {
  application_id: 1,
  archive_path: "archive/2026-07-12_acme",
  cv_url: "https://github.com/x/cv/blob/main/archive/2026-07-12_acme/cv_acme.pdf",
  letter_url: "https://github.com/x/cv/blob/main/archive/2026-07-12_acme/cover_acme.pdf",
  job_md: "# Job\n\nfull description from job.md",
};

describe("POST /api/skill/report", () => {
  beforeEach(() => {
    updates.length = 0;
    updateResult = [{ id: 1 }];
  });

  it("accepts the payload and stores both URLs and job_md as offer_text", async () => {
    const res = await POST(request(validBody));
    expect(res.status).toBe(200);
    expect(updates[0]).toContain(validBody.cv_url);
    expect(updates[0]).toContain(validBody.letter_url);
    expect(updates[0]).toContain(validBody.job_md);
  });

  it("rejects a payload missing job_md with 400", async () => {
    const { job_md: _job_md, ...withoutJobMd } = validBody;
    const res = await POST(request(withoutJobMd));
    expect(res.status).toBe(400);
    expect(updates).toHaveLength(0);
  });

  it("returns 404 for an unknown application", async () => {
    updateResult = [];
    const res = await POST(request({ ...validBody, application_id: 999 }));
    expect(res.status).toBe(404);
  });
});
