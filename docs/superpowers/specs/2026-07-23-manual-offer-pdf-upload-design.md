# Manual offer PDF upload — design

Date: 2026-07-23

## Goal

Let the user add an offer manually by uploading or dropping a PDF, in addition
to the existing "paste a link" and "paste the description text" inputs.

## Approach

Send the PDF directly to Gemini as an inline file part (base64 `inlineData`).
Gemini reads PDFs natively, so no PDF-parsing library and no client-side text
extraction are needed. The PDF flows through the same duplicate-check →
`createOffer` path as the text and link inputs.

The PDF is a **third independent option**: link, pasted text, and PDF are
alternative ways to provide the posting. A link may still accompany a PDF and
becomes the offer's canonical URL, mirroring how link + text works today.

## Changes

### `lib/llm.ts`

`chatJson` gains an optional file argument:

```ts
chatJson(prompt: string, schema: object, file?: { mimeType: string; base64: string })
```

When `file` is present, the request `parts` array includes an `inlineData`
part (`{ inlineData: { mimeType, data: base64 } }`) alongside the text part.
When absent, behavior is unchanged (text-only part).

### `lib/extract.ts`

Add `extractOfferFromPdf(base64: string, link?: string)`. Same field prompt as
`extractOfferFromText` (employer, title, location, ref_id, deadline,
requirements, link) and the same `OFFER_SCHEMA`, but passes the PDF as the file
argument to `chatJson`. If `link` is provided and the extracted offer has no
link, fill it in — identical to `extractOfferFromText`.

### `app/api/assistant/offers/route.ts`

Accept a `pdf` field (base64 string, no data-URL prefix) in the POST body.
When present:

1. Call `extractOfferFromPdf(pdf, link)`; on null return `422 extraction_failed`.
2. Run the existing duplicate check (`link ?? offer.link`, employer, ref_id).
3. `createOffer(offer, { source: "manual", posting_text: null, link: link ?? offer.link })`.

`posting_text` is `null` for the PDF path — there is no plain text to store.
Ordering in the handler: `text` → `pdf` → `link` (checked in that order; the
first non-empty input wins, consistent with the "third independent option"
model where the user provides one primary input).

### `app/assistant/components/AddOffer.tsx`

- Add a file input plus a drag-and-drop zone accepting `application/pdf`.
- Track the selected `File` in state and show its filename with a way to clear it.
- On submit, read the file via `FileReader`/`arrayBuffer` → base64 and include
  `pdf` in the existing JSON POST body.
- Reuse the current busy / message / 409-duplicate / "Add anyway" UI unchanged.

## Out of scope

- Multi-PDF batch upload.
- Storing the raw PDF or its extracted text (`posting_text` stays `null`).
- Non-PDF file types.
- File-size UI limits beyond what the browser and Gemini naturally impose.

## Testing

- Unit test `extractOfferFromPdf` builds the correct file part (mock `chatJson`).
- Existing route tests continue to pass; add a case for the `pdf` branch
  (mock extraction, assert `createOffer` called with `posting_text: null`).
