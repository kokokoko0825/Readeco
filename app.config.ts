import type { ConfigContext, ExpoConfig } from 'expo/config';

import { version } from './package.json';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'Readeco',
  slug: config.slug ?? 'Readeco',
  version,
});
