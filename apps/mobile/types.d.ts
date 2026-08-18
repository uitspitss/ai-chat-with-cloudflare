// TypeScript 7 は副作用 import に型宣言が無いと TS2882 で落ちる（5.x は黙認していた）。
declare module "*.css";

declare module "*.module.css" {
  const classes: Record<string, string>;
  export default classes;
}
