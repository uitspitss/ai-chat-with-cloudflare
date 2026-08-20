import * as Crypto from "expo-crypto";

/**
 * Hermes に無い Web の口を埋める。**`_layout.tsx` の先頭で import すること。**
 * どちらも型検査は通り、該当の画面を開いた瞬間に `ReferenceError` で落ちる。
 */

// AI SDK / Agents SDK はメッセージ ID の生成に `crypto.randomUUID()` を使う
if (typeof globalThis.crypto === "undefined") {
  Object.defineProperty(globalThis, "crypto", {
    value: {
      getRandomValues: Crypto.getRandomValues,
      randomUUID: Crypto.randomUUID,
    },
    configurable: true,
  });
}

// partysocket は WebSocket の受信フレームを `new MessageEvent(type, init)` に
// 包み直してから listener に配る（dist/ws.js）。Hermes にはこのクラスが無いので、
// **ハンドシェイクは 101 で成功するのにメッセージが 1 通も届かない**という形で出る。
if (typeof globalThis.MessageEvent === "undefined") {
  class MessageEventPolyfill<T = unknown> extends Event {
    readonly data: T;
    readonly lastEventId: string;
    readonly origin: string;

    constructor(type: string, init: { data?: T; lastEventId?: string; origin?: string } = {}) {
      super(type);
      this.data = init.data as T;
      this.lastEventId = init.lastEventId ?? "";
      this.origin = init.origin ?? "";
    }
  }

  Object.defineProperty(globalThis, "MessageEvent", {
    value: MessageEventPolyfill,
    configurable: true,
  });
}
