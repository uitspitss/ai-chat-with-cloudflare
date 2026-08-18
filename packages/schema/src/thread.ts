import { z } from "zod";

export const threadSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type Thread = z.infer<typeof threadSchema>;

export const createThreadRequestSchema = z.object({
  // 上限（200 文字）は業務ルールなので domain/thread.ts が持つ。
  // ここに書くと zValidator が先に弾き、ドメインの日本語メッセージが届かない。
  title: z.string().trim().default("New thread"),
});

export type CreateThreadRequest = z.infer<typeof createThreadRequestSchema>;
