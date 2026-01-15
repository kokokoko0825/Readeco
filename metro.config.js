// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Ensure that all platforms are included
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Block sharp and all related modules from being bundled by Metro
config.resolver.blockList = [
  // Block sharp module and all its variants
  /node_modules\/sharp\/.*/,
  /node_modules\/@img\/sharp-.*\/.*/,
  // Block sharp from being resolved
  /.*\/sharp$/,
  /.*\/@img\/sharp-.*$/,
];

// Create a custom resolver that prevents sharp from being resolved
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Block sharp and related modules
  if (
    moduleName === 'sharp' ||
    moduleName.startsWith('@img/sharp-') ||
    moduleName.includes('/sharp')
  ) {
    return {
      type: 'empty',
    };
  }

  // Use default resolver for other modules
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

