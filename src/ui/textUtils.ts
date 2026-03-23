/**
 * Wraps text to fit within a maximum character width per line.
 * Preserves paragraph breaks (newlines in input).
 */
export function wrapText(text: string, maxCharsPerLine: number): string {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(' ');
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (test.length > maxCharsPerLine && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
  }
  return lines.join('\n');
}
