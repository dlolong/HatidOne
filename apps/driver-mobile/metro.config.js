const { getDefaultConfig } = require("expo/metro-config");
const fs = require("node:fs");
const path = require("node:path");

const config = getDefaultConfig(__dirname);
const workspaceRoot = path.resolve(__dirname, "../..");
// Include workspace sources and the real dependency directory when a development
// worktree shares node_modules. Normal npm workspace installs use the same paths.
const dependencyPaths = [
  path.join(__dirname, "node_modules"),
  path.join(workspaceRoot, "node_modules"),
]
  .filter(fs.existsSync)
  .map((directory) => fs.realpathSync(directory));
config.watchFolders = [
  ...new Set([
    ...(config.watchFolders ?? []),
    workspaceRoot,
    ...dependencyPaths,
  ]),
];
config.resolver.nodeModulesPaths = dependencyPaths;
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  "@hatidone/core": path.join(workspaceRoot, "packages/core"),
  "@hatidone/mobile": path.join(workspaceRoot, "packages/mobile"),
  "@hatidone/types": path.join(workspaceRoot, "packages/types"),
};
module.exports = config;
