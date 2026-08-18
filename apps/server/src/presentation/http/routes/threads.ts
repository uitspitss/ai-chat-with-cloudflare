import { createThreadRequestSchema } from "@repo/schema";
import { Hono } from "hono";
import { z } from "zod";
import { ThreadId } from "../../../domain/shared/id";
import type { AppEnv } from "../../../env";
import { toThreadDto } from "../dto";
import { toHttpError } from "../error-response";
import { requireAuth } from "../middleware/auth";
import { injectServices } from "../middleware/services";
import { validate } from "../validator";

// branded なスキーマをそのまま zValidator に渡すと、検証と brand 付けが同時に済む。
// 形式違反は 500 ではなく 400 で返る。
const threadParam = validate("param", z.object({ id: ThreadId }));

export const threadsRoute = new Hono<AppEnv>()
  .use("*", injectServices, requireAuth)
  .get("/", async (c) => {
    const threads = await c.var.services.threadService.list(c.get("userId"));
    return c.json(threads.map(toThreadDto));
  })
  .post("/", validate("json", createThreadRequestSchema), async (c) => {
    const created = await c.var.services.threadService.create(c.get("userId"), c.req.valid("json"));
    if (created.isErr()) {
      const { body, status } = toHttpError(created.error);
      return c.json(body, status);
    }
    return c.json(toThreadDto(created.value), 201);
  })
  .delete("/:id", threadParam, async (c) => {
    const removed = await c.var.services.threadService.remove(
      c.req.valid("param").id,
      c.get("userId"),
    );
    if (removed.isErr()) {
      const { body, status } = toHttpError(removed.error);
      return c.json(body, status);
    }
    return c.json(toThreadDto(removed.value));
  });
