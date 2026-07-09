import { describe, it, expect } from "vitest";
import { toCsv } from "../csv";

const columns = [
  { key: "a", header: "A" },
  { key: "b", header: "B" },
];

describe("toCsv", () => {
  it("renders header and rows", () => {
    expect(toCsv([{ a: "1", b: "x" }], columns)).toBe("A,B\r\n1,x\r\n");
  });

  it("escapes quotes, commas and newlines", () => {
    const csv = toCsv([{ a: 'say "hi", ok', b: "line1\nline2" }], columns);
    expect(csv).toBe('A,B\r\n"say ""hi"", ok","line1\nline2"\r\n');
  });

  it("renders null and undefined as empty cells", () => {
    expect(toCsv([{ a: null, b: undefined }], columns)).toBe("A,B\r\n,\r\n");
  });
});
