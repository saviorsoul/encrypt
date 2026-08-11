import { runElectron } from './electron-spawn.mjs';

process.env.VITE_DEV_SERVER_URL = 'http://localhost:5180';

runElectron(process.argv.slice(2));
