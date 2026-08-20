/**
 * withCargoOneiOSFixes — CargoOne local Expo config plugin.
 *
 * Runs at every `expo prebuild`. Repo-safe (no secrets read/written).
 *
 * Applies two iOS-side fixes that are otherwise wiped when the ios/
 * directory is regenerated:
 *
 *   1. Sets ios.deploymentTarget = "15.0" in ios/Podfile.properties.json.
 *      Required because:
 *        - react-native-passkey podspec declares s.platforms = { :ios => "15.0" }
 *        - @stripe/stripe-react-native 0.38 requires iOS 15+
 *        - Passkeys (ASAuthorizationPlatformPublicKeyCredential) is iOS 15+
 *      Without this, `pod install` fails with:
 *        "react-native-passkey ... required a higher minimum deployment target"
 *
 *   2. Prepends a one-line env alias to ios/Podfile so developers can supply
 *      the Mapbox secret download token via EITHER of the two conventional
 *      environment variable names:
 *         - MAPBOX_DOWNLOADS_TOKEN         (the name in Mapbox's own docs
 *                                            and used by Android Gradle)
 *         - RNMAPBOX_MAPS_DOWNLOAD_TOKEN   (what the @rnmapbox/maps
 *                                            podspec's curl monkey-patch
 *                                            actually reads)
 *
 *      No token value is ever written to disk here. Only the env fallback
 *      line: `ENV['RNMAPBOX_MAPS_DOWNLOAD_TOKEN'] ||= ENV['MAPBOX_DOWNLOADS_TOKEN']`
 *
 *      When neither env var is set, pod install fails with a 401 from
 *      api.mapbox.com — which is the intended failure mode (see mobile/SECRETS.md).
 *
 * Both operations are idempotent and marker-guarded — safe on repeated
 * `expo prebuild` runs.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PODFILE_MARKER_BEGIN = '# BEGIN CargoOne Mapbox env alias';
const PODFILE_MARKER_END = '# END CargoOne Mapbox env alias';

function ensureDeploymentTarget(iosDir) {
  const propsPath = path.join(iosDir, 'Podfile.properties.json');
  const props = fs.existsSync(propsPath)
    ? JSON.parse(fs.readFileSync(propsPath, 'utf8'))
    : {};
  if (props['ios.deploymentTarget'] !== '15.0') {
    props['ios.deploymentTarget'] = '15.0';
    fs.writeFileSync(propsPath, JSON.stringify(props, null, 2) + '\n');
  }
}

function ensurePodfileEnvAlias(iosDir) {
  const podfilePath = path.join(iosDir, 'Podfile');
  if (!fs.existsSync(podfilePath)) return;
  const contents = fs.readFileSync(podfilePath, 'utf8');
  if (contents.includes(PODFILE_MARKER_BEGIN)) return;
  const snippet =
    `${PODFILE_MARKER_BEGIN}\n` +
    `# Let developers supply the Mapbox secret download token via either\n` +
    `# MAPBOX_DOWNLOADS_TOKEN (Mapbox's canonical env var name, also used\n` +
    `# by Android Gradle) or RNMAPBOX_MAPS_DOWNLOAD_TOKEN (what @rnmapbox/maps\n` +
    `# actually reads at pod-install time). Never store the token here.\n` +
    `ENV['RNMAPBOX_MAPS_DOWNLOAD_TOKEN'] ||= ENV['MAPBOX_DOWNLOADS_TOKEN']\n` +
    `${PODFILE_MARKER_END}\n\n`;
  fs.writeFileSync(podfilePath, snippet + contents);
}

module.exports = function withCargoOneiOSFixes(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const iosDir = cfg.modRequest.platformProjectRoot;
      ensureDeploymentTarget(iosDir);
      ensurePodfileEnvAlias(iosDir);
      return cfg;
    },
  ]);
};
