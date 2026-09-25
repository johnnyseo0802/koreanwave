export type QuestionInput = { title: string; body: string };

// Unicode code points match PostgreSQL char_length, unlike UTF-16 string.length.
export function questionLength(value: string) {
  return Array.from(value.trim()).length;
}

export function validateQuestion({ title, body }: QuestionInput): string | null {
  if (questionLength(title) < 5 || questionLength(title) > 160) {
    return "Enter a title between 5 and 160 characters, excluding surrounding spaces.";
  }
  if (questionLength(body) < 10 || questionLength(body) > 5000) {
    return "Enter a question between 10 and 5,000 characters, excluding surrounding spaces.";
  }
  return null;
}
