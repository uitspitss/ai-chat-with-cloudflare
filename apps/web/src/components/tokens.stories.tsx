import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

/**
 * **CSS が読み込まれているかの番人。**
 *
 * preview.tsx で styles.css を import し忘れると、他のストーリーは
 * 「素の HTML だが一応表示される」状態になり、見た目がおかしいだけで
 * テストは全部通ってしまう。ここが最初に落ちるようにしておく。
 */
function Tokens() {
  return (
    <div className="bg-background text-foreground flex flex-col gap-2 p-4">
      <p data-testid="probe" className="text-muted-foreground">
        トークンが効いていれば背景と文字色が付く
      </p>
    </div>
  );
}

const meta: Meta<typeof Tokens> = { component: Tokens };
export default meta;

export const Default: StoryObj<typeof Tokens> = {
  play: async ({ canvas }) => {
    const probe = canvas.getByTestId("probe");
    const color = getComputedStyle(probe).color;

    // Tailwind が効いていなければ既定色（rgb(0, 0, 0)）のまま
    await expect(color).not.toBe("rgb(0, 0, 0)");
    await expect(color).not.toBe("");
  },
};
