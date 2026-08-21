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
 *   2. Prepends a single line to the generated ios/Podfile that
 *      forwards the developer's shell env var to the rnmapbox Ruby
 *      global that the podspec actually reads:
 *
 *        $RNMapboxMapsDownloadToken ||= (
 *          ENV['RNMAPBOX_MAPS_DOWNLOAD_TOKEN'] || ENV['MAPBOX_DOWNLOADS_TOKEN']
 *        )
 *
 *      Why the Ruby global, not just ENV?
 *      - @rnmapbox/maps@10.1.31's podspec ONLY reads the Ruby global
 *        `$RNMapboxMapsDownloadToken`. It has no ENV fallback path,
 *        so an ENV-only alias is a no-op there.
 *      - @rnmapbox/maps@10.2.x's podspec DOES also read
 *        ENV['RNMAPBOX_MAPS_DOWNLOAD_TOKEN'], but only when the Ruby
 *        global is nil — so setting the global still works.
 *      Setting the global covers both major-line branches.
 *      Developers can supply the token via EITHER env var name:
 *         - MAPBOX_DOWNLOADS_TOKEN         (Mapbox's canonical name;
 *                                            also used by Android)
 *         - RNMAPBOX_MAPS_DOWNLOAD_TOKEN   (rnmapbox-specific)
 *
 *      No token value is ever written to disk here. When neither env
 *      var is set, pod install fails with a 401 from api.mapbox.com —
 *      the intended failure mode (see mobile/SECRETS.md).
 *
 * Both operations are idempotent and marker-guarded — safe on repeated
 * `expo prebuild` runs. Any previous version of the block is stripped
 * before the current one is written so upgrades never leave stale
 * comments behind.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PODFILE_MARKER_BEGIN = '# BEGIN CargoOne Mapbox downloads token';
const PODFILE_MARKER_END = '# END CargoOne Mapbox downloads token';
// Any block whose BEGIN marker contains this substring is considered
// ours and will be removed on the next prebuild.
const LEGACY_BEGIN_PATTERN = /^# BEGIN CargoOne Mapbox[\s\S]*?^# END CargoOne Mapbox[^\n]*\n?/m;

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

function ensurePodfileTokenBridge(iosDir) {
  const podfilePath = path.join(iosDir, 'Podfile');
  if (!fs.existsSync(podfilePath)) return;
  let contents = fs.readFileSync(podfilePath, 'utf8');
  // Remove ANY prior CargoOne Mapbox block (may loop if plugin was
  // invoked multiple times before this cleanup was in place).
  while (LEGACY_BEGIN_PATTERN.test(contents)) {
    contents = contents.replace(LEGACY_BEGIN_PATTERN, '');
  }
  const snippet =
    `${PODFILE_MARKER_BEGIN}\n` +
    `# Forward the developer's shell env var into the rnmapbox Ruby\n` +
    `# global that the podspec's curl monkey-patch reads. Never stores\n` +
    `# the token value on disk. Accepts either canonical env var name.\n` +
    `$RNMapboxMapsDownloadToken ||= (ENV['RNMAPBOX_MAPS_DOWNLOAD_TOKEN'] || ENV['MAPBOX_DOWNLOADS_TOKEN'])\n` +
    `${PODFILE_MARKER_END}\n\n`;
  fs.writeFileSync(podfilePath, snippet + contents);
}

module.exports = function withCargoOneiOSFixes(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const iosDir = cfg.modRequest.platformProjectRoot;
      ensureDeploymentTarget(iosDir);
      ensurePodfileTokenBridge(iosDir);
      return cfg;
    },
  ]);
};
