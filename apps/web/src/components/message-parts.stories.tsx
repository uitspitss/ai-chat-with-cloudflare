import type { Meta, StoryObj } from "@storybook/react-vite";
import type { UIMessage } from "ai";
import { expect } from "storybook/test";
import { MessageParts } from "./message-parts";

/**
 * 会話の見た目はここで確かめる。**E2E では状態を作るのにサーバーと LLM が要る**が、
 * ここなら「ツール実行中」「ツールがエラー」のような途中状態を直接与えられる。
 */
const meta: Meta<typeof MessageParts> = {
  component: MessageParts,
  args: { align: "start" },
  // 吹き出しは幅がある前提の見た目なので、狭い枠で見ない
  decorators: [
    (Story) => (
      <div className="bg-background flex w-[36rem] flex-col gap-2 p-4">
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof MessageParts>;

const msg = (parts: unknown[]): UIMessage => ({ id: "m1", role: "assistant", parts }) as UIMessage;

export const UserText: Story = {
  name: "ユーザーの発言（end）",
  args: { align: "end", message: msg([{ type: "text", text: "既知の問題を教えて" }]) },
};

export const AssistantText: Story = {
  name: "アシスタントの発言（start）",
  args: {
    align: "start",
    message: msg([
      { type: "text", text: "既知の問題は Safari でスクロール位置が復元されない点です。" },
    ]),
  },
  play: async ({ canvas }) => {
    // 話者で配色が分かれていること（両方 default にすると誰の発言か分からなくなる）
    const bubble = canvas.getByText(/Safari/).closest("[data-slot='bubble']");
    await expect(bubble).not.toBeNull();
  },
};

export const Reasoning: Story = {
  name: "思考過程",
  args: {
    message: msg([
      { type: "reasoning", text: "まず listThreadFiles でファイルの一覧を確認する必要があります" },
    ]),
  },
};

export const ToolRunning: Story = {
  name: "ツール実行中",
  args: {
    message: msg([
      {
        type: "tool-readThreadFile",
        toolCallId: "c1",
        state: "input-available",
        input: { name: "release-notes.md" },
      },
    ]),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  },
};

export const ToolDone: Story = {
  name: "ツールの結果",
  args: {
    message: msg([
      {
        type: "tool-readThreadFile",
        toolCallId: "c2",
        state: "output-available",
        input: { name: "release-notes.md" },
        output: { name: "release-notes.md", truncated: false, content: "## 既知の問題" },
      },
    ]),
  },
  play: async ({ canvas }) => {
    // 完了しているので Spinner は消えている
    await expect(canvas.queryByRole("status")).not.toBeInTheDocument();
  },
};

export const ToolError: Story = {
  name: "ツールのエラー",
  args: {
    message: msg([
      {
        type: "tool-readThreadFile",
        toolCallId: "c3",
        state: "output-error",
        input: { name: "missing.md" },
        errorText: '"missing.md" はこの会話に添付されていない',
      },
    ]),
  },
};

export const LongText: Story = {
  name: "長文（折り返しの確認）",
  args: {
    align: "end",
    message: msg([{ type: "text", text: "あ".repeat(400) }]),
  },
};

export const Conversation: Story = {
  name: "一連の流れ",
  render: () => (
    <>
      <MessageParts align="end" message={msg([{ type: "text", text: "既知の問題を教えて" }])} />
      <MessageParts
        align="start"
        message={msg([
          { type: "reasoning", text: "添付ファイルを確認する" },
          {
            type: "tool-readThreadFile",
            toolCallId: "c1",
            state: "output-available",
            input: { name: "release-notes.md" },
            output: { content: "## 既知の問題" },
          },
          { type: "text", text: "Safari でスクロール位置が復元されない点です。" },
        ])}
      />
    </>
  ),
};
