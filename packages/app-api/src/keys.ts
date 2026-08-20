/**
 * TanStack Query の queryKey。**関数本体はここに置かない。**
 * このパッケージは TanStack Query に依存しない（依存させると web と mobile が
 * 同じバージョンに縛られる）ので、キーだけを共有して組み立ては各アプリが行う。
 */
export const threadsKey = ["threads"] as const;

export const attachmentsKey = (threadId: string) => ["attachments", threadId] as const;
