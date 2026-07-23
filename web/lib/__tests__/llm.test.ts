import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseModelJson, geminiText, chatJson } from "../llm";

describe("parseModelJson", () => {
  it("parses plain JSON", () => {
    expect(parseModelJson('{"a": 1}')).toEqual({ a: 1 });
  });

  it("parses JSON inside a markdown fence", () => {
    expect(parseModelJson('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  it("parses JSON surrounded by prose", () => {
    expect(parseModelJson('Here you go: {"offers": []} Hope that helps!')).toEqual({
      offers: [],
    });
  });

  it("returns null for text without JSON", () => {
    expect(parseModelJson("no json here")).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(parseModelJson('{"a": unquoted}')).toBeNull();
  });
});

describe("geminiText", () => {
  it("extracts and joins candidate part texts", () => {
    expect(
      geminiText({
        candidates: [
          { content: { parts: [{ text: '{"a":' }, { text: " 1}" }] } },
        ],
      }),
    ).toBe('{"a": 1}');
  });

  it("returns empty string for missing candidates or parts", () => {
    expect(geminiText({})).toBe("");
    expect(geminiText({ candidates: [] })).toBe("");
    expect(geminiText({ candidates: [{ content: {} }] })).toBe("");
    expect(geminiText(null)).toBe("");
  });
});

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
