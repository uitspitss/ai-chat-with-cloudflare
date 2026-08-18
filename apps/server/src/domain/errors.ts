/**
 * ドメイン / ユースケースが返しうる失敗。**例外ではなく値として返す**（neverthrow）。
 * presentation 側は ts-pattern の `.exhaustive()` で HTTP へ写像するので、
 * ここに枝を足すとルート側が型エラーになり、対応漏れがコンパイル時に分かる。
 */
export type DomainError =
  | { readonly type: "InvalidTitle"; readonly message: string }
  | { readonly type: "InvalidFileSize"; readonly message: string }
  | { readonly type: "InvalidContentType"; readonly message: string };

export type AppError =
  | DomainError
  | { readonly type: "ThreadNotFound" }
  | { readonly type: "AttachmentNotFound" }
  | { readonly type: "ContentNotUploaded" }
  /** 申告サイズより大きい本文が送られてきた（上限の迂回） */
  | { readonly type: "ContentTooLarge" }
  /** Content-Length が無い。長さが確定しないと上限を担保できない */
  | { readonly type: "LengthRequired" };

export const invalidTitle = (message: string): DomainError => ({
  type: "InvalidTitle",
  message,
});
export const invalidFileSize = (message: string): DomainError => ({
  type: "InvalidFileSize",
  message,
});
export const invalidContentType = (message: string): DomainError => ({
  type: "InvalidContentType",
  message,
});
