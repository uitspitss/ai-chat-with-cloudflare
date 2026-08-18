import type { APIRequestContext } from "@playwright/test";
import type { FileMeta, Thread } from "@repo/schema";

/**
 * 事前データはテスト自身が API 経由で作る。開発用の seed は使わない
 * （seed が変わるたびに E2E が落ちるようにしない）。
 */

export async function createThread(request: APIRequestContext, title: string): Promise<Thread> {
  const res = await request.post("/api/threads", { data: { title } });
  if (!res.ok()) {
    throw new Error(`createThread に失敗 (${res.status()}): ${await res.text()}`);
  }
  return res.json();
}

export async function attachFile(
  request: APIRequestContext,
  threadId: string,
  file: { name: string; contentType: string; body: string },
): Promise<FileMeta> {
  const size = new TextEncoder().encode(file.body).byteLength;

  const urlRes = await request.post("/api/files/upload-url", {
    data: { threadId, name: file.name, size, contentType: file.contentType },
  });
  if (!urlRes.ok()) {
    throw new Error(`upload-url に失敗 (${urlRes.status()}): ${await urlRes.text()}`);
  }
  const { uploadUrl } = (await urlRes.json()) as { uploadUrl: string };

  const putRes = await request.put(uploadUrl, {
    data: file.body,
    headers: { "content-type": file.contentType },
  });
  if (!putRes.ok()) {
    throw new Error(`本体の PUT に失敗 (${putRes.status()}): ${await putRes.text()}`);
  }
  return putRes.json();
}
