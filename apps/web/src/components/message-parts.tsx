import type { UIMessage } from "ai";
import { WrenchIcon } from "lucide-react";
import { P, match } from "ts-pattern";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";

type ToolPart = {
  type: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

function ToolCall({ part }: { part: ToolPart }) {
  const name = part.type === "dynamic-tool" ? "(dynamic)" : part.type.slice("tool-".length);
  const running = part.state === "input-streaming" || part.state === "input-available";

  return (
    <Item variant="muted" size="sm">
      <ItemMedia variant="icon">{running ? <Spinner /> : <WrenchIcon />}</ItemMedia>
      <ItemContent>
        <ItemTitle className="font-mono">{name}</ItemTitle>
        {part.input != null && (
          <ItemDescription className="font-mono whitespace-pre-wrap">
            {JSON.stringify(part.input)}
          </ItemDescription>
        )}
        {part.state === "output-available" && (
          <ItemDescription className="font-mono whitespace-pre-wrap">
            {JSON.stringify(part.output)}
          </ItemDescription>
        )}
        {part.state === "output-error" && (
          <ItemDescription className="text-destructive">{part.errorText}</ItemDescription>
        )}
      </ItemContent>
    </Item>
  );
}

/**
 * UIMessage.parts を描画する。text と tool 呼び出し（実行中 / 結果 / エラー）だけを扱う。
 * 吹き出しは自前の div ではなく Bubble に任せる。
 */
export function MessageParts({ message, align }: { message: UIMessage; align: "start" | "end" }) {
  // align="end" が現在のユーザー側。相手側と同じ配色にすると誰の発言か分からない
  const variant = align === "end" ? "default" : "secondary";

  return (
    <>
      {message.parts.map((part, index) => {
        const key = `${message.id}-${index}`;

        return (
          match(part)
            .with({ type: "text" }, (p) => (
              <Bubble key={key} align={align} variant={variant}>
                <BubbleContent className="whitespace-pre-wrap">{p.text}</BubbleContent>
              </Bubble>
            ))
            .with({ type: "reasoning" }, (p) => (
              <Bubble key={key} align={align} variant="ghost">
                <BubbleContent className="text-muted-foreground whitespace-pre-wrap italic">
                  {p.text}
                </BubbleContent>
              </Bubble>
            ))
            // ai@7 のツール part は "tool-<ツール名>"（動的ツールは "dynamic-tool"）
            .with({ type: P.string.startsWith("tool-") }, { type: "dynamic-tool" }, (p) => (
              <ToolCall key={key} part={p as ToolPart} />
            ))
            .otherwise(() => null)
        );
      })}
    </>
  );
}
