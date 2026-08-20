import type { UIMessage } from "ai";
import { Text, View } from "react-native";

/**
 * UIMessage.parts を描画する。text / reasoning / ツール呼び出しだけを扱う。
 * web 側（`apps/web/src/components/message-parts.tsx`）と同じ範囲を、
 * RN のプリミティブで表現したもの。**UI は RN と DOM で共有できない。**
 */
export function MessageParts({ message }: { message: UIMessage }) {
  const mine = message.role === "user";

  return (
    <>
      {message.parts.map((part, index) => {
        const key = `${message.id}-${index}`;

        if (part.type === "text") {
          return (
            <View
              key={key}
              className={
                mine
                  ? "self-end rounded-xl bg-primary px-3 py-2"
                  : "self-start rounded-xl bg-secondary px-3 py-2"
              }
            >
              <Text className={mine ? "text-primary-foreground" : "text-secondary-foreground"}>
                {part.text}
              </Text>
            </View>
          );
        }

        if (part.type === "reasoning") {
          return (
            <Text key={key} className="italic text-muted-foreground">
              {part.text}
            </Text>
          );
        }

        // ai@7 のツール part は "tool-<ツール名>"（動的ツールは "dynamic-tool"）
        if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
          const name = part.type === "dynamic-tool" ? "(dynamic)" : part.type.slice("tool-".length);
          return (
            <View key={key} className="self-start rounded-lg bg-muted px-3 py-2">
              <Text className="font-mono text-muted-foreground">{name}</Text>
            </View>
          );
        }

        return null;
      })}
    </>
  );
}
