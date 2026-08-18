import type { Preview } from "@storybook/react-vite";
// アプリと同じトークンを読ませる。これが無いと shadcn の見た目が一切出ない。
import "../src/styles.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: { color: /(background|color)$/i, date: /Date$/i },
    },
  },
};

export default preview;
