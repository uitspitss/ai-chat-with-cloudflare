const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// モノレポのルート node_modules も解決対象にする
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
// pnpm の strict resolution では .pnpm/<pkg>/node_modules/<dep> 階層を辿る必要があるため
// 階層解決を有効にしておく。Expo 公式ガイドは npm/yarn 向けに true を勧めるが、
// pnpm では false（＝既定のまま）でないと expo-router の deep 依存が解決できない。
config.resolver.disableHierarchicalLookup = false;

// Tailwind v4 は Metro の transformer 越しに効く（babel の preset は要らない）。
// globalClassNamePolyfill は既定で true なので、素の RN コンポーネントが
// そのまま className を受け取る。
module.exports = withNativewind(config);
