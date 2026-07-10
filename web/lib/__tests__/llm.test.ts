import { describe, it, expect } from "vitest";
import { parseModelJson, geminiText } from "../llm";

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
