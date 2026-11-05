// Expo SDK 51 monorepo config. Forces a single copy of React / React Native in the bundle
// (lucide-react-native ships nested copies that otherwise create a second BatchedBridge).
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

const SINGLETONS = /^(react|react-native|react-native-svg|scheduler)(\/.*)?$|^@react-native\//;
const appOrigin = path.join(projectRoot, "index.ts");

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (SINGLETONS.test(moduleName)) {
    return context.resolveRequest({ ...context, originModulePath: appOrigin }, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
