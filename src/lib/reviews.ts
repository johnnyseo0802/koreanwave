export type ReviewResult = { ok: boolean; message: string; loginRequired?: boolean };

export function reviewLength(body: string) {
  return Array.from(body.trim()).length;
}

export function validateReview(body: string): string | null {
  const length = reviewLength(body);
  return length < 2 || length > 5000
    ? "Enter a review between 2 and 5,000 characters, excluding surrounding spaces."
    : null;
}
