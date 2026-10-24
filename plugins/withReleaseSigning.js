const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Signs release builds with the upload key described in a keystore.properties file kept OUTSIDE
 * the repo. Path: the `pannaSigningProperties` Gradle property, or ../../panna-signing/keystore.properties
 * next to the project folder. Without the file, release builds fall back to the debug key (local testing).
 */
const MARKER = '// panna: release signing';

const SIGNING_CONFIG = `
        release {
            ${MARKER}
            def propsPath = findProperty('pannaSigningProperties') ?: new File(rootDir, '../../panna-signing/keystore.properties').path
            def propsFile = file(propsPath)
            if (propsFile.exists()) {
                def props = new Properties()
                propsFile.withInputStream { props.load(it) }
                storeFile file(props['storeFile'])
                storePassword props['storePassword']
                keyAlias props['keyAlias']
                keyPassword props['keyPassword']
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (gradle.includes(MARKER)) return cfg;

    gradle = gradle.replace(/signingConfigs\s*\{\s*debug\s*\{[^}]*\}/, (match) => `${match}${SIGNING_CONFIG}`);
    gradle = gradle.replace(
      /(release\s*\{[^}]*?)signingConfig signingConfigs\.debug/,
      `$1signingConfig signingConfigs.release.storeFile != null ? signingConfigs.release : signingConfigs.debug`,
    );
    cfg.modResults.contents = gradle;
    return cfg;
  });
};
