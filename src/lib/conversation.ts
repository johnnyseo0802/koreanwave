export const reactionKinds = ["like", "interesting", "agree"] as const;
export type ReactionKind = typeof reactionKinds[number];
export const conversationId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function commentError(body: unknown): string | null {
  return typeof body !== "string" || Array.from(body.trim()).length < 2 || Array.from(body.trim()).length > 2000
    ? "Write 2–2,000 characters, excluding surrounding spaces." : null;
}
export type Comment = { id: string; post_id?: string; parent_comment_id: string | null; body: string; status: string; created_at: string };
export type Activity = { post_id: string; comments: number; reactions: number; participants: number; last_activity: string; score: number };
export type ConversationResult = { ok: boolean; message: string };
