import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// globals: true を使わない方針なので自動 cleanup が登録されない。手動で入れる。
afterEach(cleanup);
