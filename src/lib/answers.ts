export type AnswerResult = { ok: boolean; message: string; loginRequired?: boolean };

export function answerLength(body: string) {
  return Array.from(body.trim()).length;
}

export function validateAnswer(body: string): string | null {
  const length = answerLength(body);
  return length < 2 || length > 5000
    ? "Enter an answer between 2 and 5,000 characters, excluding surrounding spaces."
    : null;
}
