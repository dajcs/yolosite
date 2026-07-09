import { describe, it, expect } from "vitest";
import { parseModelJson } from "../llm";

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
