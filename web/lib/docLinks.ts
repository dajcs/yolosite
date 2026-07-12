export function docName(url: string): string {
  return url.split("/").pop()!.replace(/\.[^.]+$/, "");
}
