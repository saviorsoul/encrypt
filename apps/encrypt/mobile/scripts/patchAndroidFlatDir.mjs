import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cordovaPluginsGradle = path.resolve(
  __dirname,
  '../android/capacitor-cordova-android-plugins/build.gradle',
);

try {
  const source = readFileSync(cordovaPluginsGradle, 'utf8');
  const patched = source.replace(/\n\s*flatDir\s*\{[^}]*\}/, '');

  if (patched !== source) {
    writeFileSync(cordovaPluginsGradle, patched);
    console.log(
      'Removed flatDir from capacitor-cordova-android-plugins/build.gradle',
    );
  }
} catch (error) {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'ENOENT'
  ) {
    console.log(
      'Skipped flatDir patch: capacitor-cordova-android-plugins/build.gradle not found (run cap sync first)',
    );
  } else {
    throw error;
  }
}
