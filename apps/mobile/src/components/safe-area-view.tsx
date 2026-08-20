import type { ComponentProps } from "react";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";
import { useCssElement } from "react-native-css";

/**
 * `className` を受け取る SafeAreaView。
 *
 * **NativeWind の `globalClassNamePolyfill` は `react-native` の解決を差し替えるだけ**で、
 * サードパーティのコンポーネント（ここでは react-native-safe-area-context）には効かない。
 * className を渡しても黙って無視され、`flex-1` が付かずに**高さ 0 の空白画面になる**
 * （エラーは出ないので原因が分かりにくい）。CSS 対応は明示的に付ける必要がある。
 */
export function SafeAreaView(
  props: ComponentProps<typeof RNSafeAreaView> & { className?: string },
) {
  return useCssElement(RNSafeAreaView, props, { className: "style" });
}
