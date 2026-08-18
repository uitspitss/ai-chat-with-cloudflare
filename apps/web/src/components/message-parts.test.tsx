import { render, screen } from "@testing-library/react";
import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import { MessageParts } from "@/components/message-parts";

function message(parts: UIMessage["parts"]): UIMessage {
  return { id: "m1", role: "assistant", parts };
}

describe("MessageParts", () => {
  it("text part をそのまま描画する", () => {
    render(<MessageParts align="start" message={message([{ type: "text", text: "やあ" }])} />);
    expect(screen.getByText("やあ")).toBeInTheDocument();
  });

  it("実行中のツール呼び出しは Spinner を出す", () => {
    render(
      <MessageParts
        align="start"
        message={message([
          {
            type: "tool-getCurrentTime",
            toolCallId: "c1",
            state: "input-available",
            input: {},
          },
        ] as unknown as UIMessage["parts"])}
      />,
    );
    expect(screen.getByText("getCurrentTime")).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("ツールの結果を表示する", () => {
    render(
      <MessageParts
        align="start"
        message={message([
          {
            type: "tool-readThreadFile",
            toolCallId: "c2",
            state: "output-available",
            input: { name: "a.md" },
            output: { content: "hello" },
          },
        ] as unknown as UIMessage["parts"])}
      />,
    );
    expect(screen.getByText(/"content":"hello"/)).toBeInTheDocument();
    // 完了しているので Spinner は出ない
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
