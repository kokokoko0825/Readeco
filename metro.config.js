// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Ensure that all platforms are included
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

module.exports = config;

