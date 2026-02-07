const HEBREW_WORDS_REGEX =
  /[\u0590-\u05FF][\u0590-\u05FF"'\-_ /\\]*[\u0590-\u05FF]/g;

/**
 * ONE Zero sends Hebrew text with \u202d (LTR override) characters
 * and Hebrew substrings in reversed order. This fixes both issues.
 */
export function sanitizeHebrew(text: string): string {
  if (!text.includes("\u202d")) {
    return text.trim();
  }

  const plain = text.replace(/\u202d/gi, "").trim();
  const matches = [...plain.matchAll(HEBREW_WORDS_REGEX)];

  const ranges = matches.map((m) => ({
    start: m.index,
    end: m.index + m[0].length,
  }));

  const out: string[] = [];
  let idx = 0;

  for (const { start, end } of ranges) {
    out.push(plain.substring(idx, start));
    out.push([...plain.substring(start, end)].reverse().join(""));
    idx = end;
  }

  out.push(plain.substring(idx));
  return out.join("");
}
