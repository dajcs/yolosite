# Manual Offer PDF Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user add an offer manually by uploading or dropping a PDF, alongside the existing paste-a-link and paste-text inputs.

**Architecture:** The PDF is sent to Gemini as an inline base64 file part (`inlineData`); Gemini reads PDFs natively, so no PDF-parsing library is added. The PDF flows through the same duplicate-check → `createOffer` path as the text and link inputs, as a third independent input.

**Tech Stack:** Next.js 16 route handlers, React 19 client component, Gemini `generateContent` REST API, Vitest.

## Global Constraints

- All work is under `web/`. Run commands from `web/` (`npm test`, `npm run lint`).
- Keep it simple: no PDF-parsing dependency, no defensive validation beyond what the flow needs, no new features beyond the PDF input.
- Follow existing patterns: Gemini schema uses uppercase OpenAPI types; offers created with `source: "manual"`.
- PDF path stores `posting_text: null` (no plain text available).
- Handler input precedence: `text` → `pdf` → `link` (first non-empty wins).

---

### Task 1: `chatJson` accepts an optional inline file part

**Files:**
- Modify: `web/lib/llm.ts` (the `chatJson` function)
- Test: `web/lib/__tests__/llm.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `chatJson(prompt: string, schema: object, file?: { mimeType: string; base64: string }): Promise<unknown | null>`. When `file` is present, the request `contents[0].parts` includes `{ inlineData: { mimeType, data: base64 } }` after the text part.

- [ ] **Step 1: Write the failing test**

Add to `web/lib/__tests__/llm.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseModelJson, geminiText, chatJson } from "../llm";

describe("chatJson", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.GEMINI_API_KEY;
  });

  function stubFetch() {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("sends a text-only part when no file is given", async () => {
    const fetchMock = stubFetch();
    await chatJson("hello", { type: "OBJECT" });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.contents[0].parts).toEqual([{ text: "hello" }]);
  });

  it("appends an inlineData part when a file is given", async () => {
    const fetchMock = stubFetch();
    await chatJson("hello", { type: "OBJECT" }, {
      mimeType: "application/pdf",
      base64: "QUJD",
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.contents[0].parts).toEqual([
      { text: "hello" },
      { inlineData: { mimeType: "application/pdf", data: "QUJD" } },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- llm`
Expected: FAIL — the `inlineData` assertion fails because `chatJson` ignores the third argument (and `chatJson` may not yet be exported/typed for a third arg).

- [ ] **Step 3: Write minimal implementation**

In `web/lib/llm.ts`, change the `chatJson` signature and body construction:

```ts
export async function chatJson(
  prompt: string,
  schema: object,
  file?: { mimeType: string; base64: string },
): Promise<unknown | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.GEMINI_MODEL ?? "gemini-flash-lite-latest";

  const parts: object[] = [{ text: prompt }];
  if (file) parts.push({ inlineData: { mimeType: file.mimeType, data: file.base64 } });

  let response: Response;
  try {
    response = await fetch(`${GEMINI_BASE}/${model}:generateContent`, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema,
        },
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    return null;
  }
  if (response.status === 429) throw new RateLimitedError("Gemini rate limit");
  if (!response.ok) return null;

  return parseModelJson(geminiText(await response.json()));
}
```

Leave the explanatory comment about `gemini-flash-lite-latest` in place above the `model` line.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- llm`
Expected: PASS (all `parseModelJson`, `geminiText`, and `chatJson` tests).

- [ ] **Step 5: Commit**

```bash
git add web/lib/llm.ts web/lib/__tests__/llm.test.ts
git commit -m "feat: chatJson accepts an optional inline file part

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `extractOfferFromPdf`

**Files:**
- Modify: `web/lib/extract.ts`
- Test: `web/lib/__tests__/extract.test.ts`

**Interfaces:**
- Consumes: `chatJson(prompt, schema, file?)` from Task 1; `OFFER_SCHEMA` and `normalizeOffer` already in `extract.ts`.
- Produces: `extractOfferFromPdf(base64: string, link?: string): Promise<ExtractedOffer | null>`. Passes the PDF as `{ mimeType: "application/pdf", base64 }` to `chatJson`; if `link` is given and the extracted offer has no `link`, fills it in.

- [ ] **Step 1: Write the failing test**

Add to `web/lib/__tests__/extract.test.ts` (the file already mocks `../llm` and imports `chatJson`; extend the import line to also import `extractOfferFromPdf`):

```ts
import { normalizeOffer, extractOffersFromEmail, extractOfferFromPdf } from "../extract";
```

Then add a describe block:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- extract`
Expected: FAIL with an error that `extractOfferFromPdf` is not exported / not a function.

- [ ] **Step 3: Write minimal implementation**

Append to `web/lib/extract.ts`:

```ts
export async function extractOfferFromPdf(
  base64: string,
  link?: string,
): Promise<ExtractedOffer | null> {
  const prompt = `Attached is a PDF of a job posting. Extract its key characteristics: employer (company name), title (position title), location (city/country), ref_id (job reference id), deadline (application deadline), requirements (2-4 sentence summary of the key requirements), link (direct URL to the job posting). Use null for anything not present.${
    link ? `\n\nPosting URL: ${link}` : ""
  }`;

  const offer = normalizeOffer(
    await chatJson(prompt, OFFER_SCHEMA, { mimeType: "application/pdf", base64 }),
  );
  if (offer && link && !offer.link) offer.link = link;
  return offer;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- extract`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/lib/extract.ts web/lib/__tests__/extract.test.ts
git commit -m "feat: extractOfferFromPdf extracts an offer from a PDF via Gemini

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Offers route accepts a `pdf` field

**Files:**
- Modify: `web/app/api/assistant/offers/route.ts`
- Test: `web/app/api/assistant/offers/route.test.ts` (create)

**Interfaces:**
- Consumes: `extractOfferFromPdf` from Task 2; existing `findDuplicate`, `createOffer`, `duplicateResponse`.
- Produces: POST handling for `body.pdf` (base64 string). On success returns `{ id }` with status 201; on failed extraction returns `422 extraction_failed`; runs the same duplicate check and 409 response as the other paths. `createOffer` is called with `{ source: "manual", posting_text: null, link: link ?? offer.link }`.

- [ ] **Step 1: Write the failing test**

Create `web/app/api/assistant/offers/route.test.ts`:

```ts
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

  it("extracts from the pdf and creates an offer with null posting_text", async () => {
    extractPdfMock.mockResolvedValue({ title: "Dev", employer: "ESA", link: null });
    const res = await POST(request({ pdf: "QUJD" }));
    expect(res.status).toBe(201);
    expect(extractPdfMock).toHaveBeenCalledWith("QUJD", undefined);
    expect(createOfferMock).toHaveBeenCalledWith(
      { title: "Dev", employer: "ESA", link: null },
      { source: "manual", posting_text: null, link: null },
    );
  });

  it("returns 422 when extraction fails", async () => {
    extractPdfMock.mockResolvedValue(null);
    const res = await POST(request({ pdf: "QUJD" }));
    expect(res.status).toBe(422);
    expect(createOfferMock).not.toHaveBeenCalled();
  });

  it("returns 409 on a duplicate", async () => {
    extractPdfMock.mockResolvedValue({ title: "Dev", employer: "ESA", link: null });
    findDuplicateMock.mockResolvedValue({ link: "https://x", offerId: 1 });
    const res = await POST(request({ pdf: "QUJD" }));
    expect(res.status).toBe(409);
    expect(createOfferMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- offers/route`
Expected: FAIL — the `pdf` branch does not exist yet, so the request falls through to the `400 "Provide a link or text"` response.

- [ ] **Step 3: Write minimal implementation**

In `web/app/api/assistant/offers/route.ts`, add the import:

```ts
import { extractOfferFromText, extractOfferFromPdf } from "@/lib/extract";
```

Widen the body type and add a `pdf` variable:

```ts
  const body = (await req.json()) as {
    link?: string;
    text?: string;
    pdf?: string;
    force?: boolean;
  };
  const link = body.link?.trim() || undefined;
  const text = body.text?.trim() || undefined;
  const pdf = body.pdf?.trim() || undefined;
  const force = body.force === true;
```

Insert a new branch after the existing `if (text) { ... }` block and before `if (link) { ... }`:

```ts
  if (pdf) {
    const offer = await extractOfferFromPdf(pdf, link);
    if (!offer) {
      return NextResponse.json({ error: "extraction_failed" }, { status: 422 });
    }
    if (!force) {
      const dup = await findDuplicate({
        link: link ?? offer.link,
        employer: offer.employer,
        ref_id: offer.ref_id,
      });
      if (dup) return duplicateResponse(dup);
    }
    const id = await createOffer(offer, {
      source: "manual",
      posting_text: null,
      link: link ?? offer.link,
    });
    return NextResponse.json({ id }, { status: 201 });
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- offers/route`
Expected: PASS (all three cases).

- [ ] **Step 5: Commit**

```bash
git add web/app/api/assistant/offers/route.ts web/app/api/assistant/offers/route.test.ts
git commit -m "feat: offers route accepts a pdf field for manual add

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: AddOffer form — PDF file input + drop zone

**Files:**
- Modify: `web/app/assistant/components/AddOffer.tsx`

**Interfaces:**
- Consumes: the POST `/api/assistant/offers` `pdf` field from Task 3.
- Produces: UI only. Reads the chosen `File` as base64 (strips the `data:...;base64,` prefix) and includes it as `pdf` in the existing JSON body.

Note: this component has no unit tests in the repo (consistent with the other assistant components). Verification is `npm run lint` + a build; the behavior is confirmed manually in Task 5.

- [ ] **Step 1: Add a base64 reader helper and `file` state**

At the top of `web/app/assistant/components/AddOffer.tsx`, below the imports, add:

```ts
function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve((reader.result as string).split(",", 2)[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
```

Inside the component, add state next to the existing ones:

```ts
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
```

- [ ] **Step 2: Send the PDF in `post`**

Change the `post` function body so it builds the request body with the base64 PDF when a file is selected. Replace the `fetch` call's body construction:

```ts
  async function post(force: boolean) {
    setBusy(true);
    setMessage("");
    setDup(null);
    const pdf = file ? await readAsBase64(file) : undefined;
    const res = await fetch("/api/assistant/offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ link, text, pdf, force }),
    });
    setBusy(false);
```

Keep the rest of `post` unchanged, and in the success branch clear the file too:

```ts
    setLink("");
    setText("");
    setFile(null);
    setOpen(false);
    router.refresh();
```

- [ ] **Step 3: Add the drop zone + file input to the form**

In the JSX, after the `<textarea ... />` and before the `{message && ...}` line, add:

```tsx
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const dropped = e.dataTransfer.files[0];
          if (dropped?.type === "application/pdf") setFile(dropped);
        }}
        className={`block cursor-pointer rounded border border-dashed p-3 text-sm text-gray ${
          dragging ? "border-blue" : "border-surface2"
        }`}
      >
        {file ? `📄 ${file.name}` : "Or drop a PDF here (or click to choose)"}
        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>
      {file && (
        <button
          type="button"
          onClick={() => setFile(null)}
          className="text-sm text-gray underline"
        >
          Remove PDF
        </button>
      )}
```

- [ ] **Step 4: Lint and build**

Run: `npm run lint`
Expected: no errors in `AddOffer.tsx`.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add web/app/assistant/components/AddOffer.tsx
git commit -m "feat: AddOffer supports uploading or dropping a PDF

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Manual verification + docs

**Files:**
- Modify: `CLAUDE.md` (the `extract.ts` line in the `web/lib/` list)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 2: Manual smoke (owner)**

With the app running and signed in at `/assistant`: click "+ Add offer", drop a job-posting PDF, submit. Expected: the offer is extracted and appears in the list; `posting_text` is null for it. Retry the same PDF → 409 duplicate with an "Add anyway" button.

- [ ] **Step 3: Update CLAUDE.md**

Update the `extract.ts` description in the `web/lib/` bullet to mention PDF, e.g. change `extract.ts` `(offer extraction)` to `(offer extraction from text and PDF)`.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: note PDF offer extraction in CLAUDE.md

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- `chatJson` file part → Task 1. ✓
- `extractOfferFromPdf` → Task 2. ✓
- Route `pdf` branch, `posting_text: null`, dup check, handler ordering text→pdf→link → Task 3. ✓
- AddOffer file input + drop zone, base64, reuse of dup/message UI, link may accompany PDF (passed as `link`) → Task 4. ✓
- Out-of-scope items (multi-PDF, storing raw PDF, non-PDF types, size limits) → not implemented. ✓
- Testing section (extract unit test + route pdf branch) → Tasks 2 and 3. ✓

**Placeholder scan:** none — every code step shows full code.

**Type consistency:** `extractOfferFromPdf(base64, link?)` consistent across Tasks 2–3; `chatJson(prompt, schema, file?)` with `{ mimeType, base64 }` consistent across Tasks 1–2; `createOffer(offer, { source, posting_text, link })` matches the existing signature in `web/lib/offers.ts`.
