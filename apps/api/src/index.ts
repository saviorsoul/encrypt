import './loadEnv.js';
import { createApp } from './app.js';
import { readConfig } from './config.js';
import { logger } from './lib/logger.js';

const config = readConfig();
const app = createApp();

if (!config.feedInvitationalOnly) {
  logger.warn(
    { feedInvitationalOnly: false },
    'API running in open mode: authenticated keys are auto-registered without invitation',
  );
}

app.listen(config.port, () => {
  logger.info({ port: config.port }, 'API listening');
});
