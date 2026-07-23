const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export class RateLimitedError extends Error {}

export function parseModelJson(text: string): unknown | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function geminiText(data: unknown): string {
  const d = data as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  } | null;
  return (
    d?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? ""
  );
}

export async function chatJson(
  prompt: string,
  schema: object,
  file?: { mimeType: string; base64: string },
): Promise<unknown | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  // gemini-flash-lite-latest: fast, best free-tier limits, and the `-latest`
  // alias stays valid as Google retires pinned versions (the pinned 2.5 models
  // now 404 for new API keys). Override with GEMINI_MODEL if desired.
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
