const { getDefaultConfig } = require("expo/metro-config");
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

module.exports = config;
