/**
 * withCargoOneiOSFixes — CargoOne local Expo config plugin.
 *
 * Runs at every `expo prebuild`. Repo-safe (no secrets read/written).
 *
 * Applies three iOS-side fixes that are otherwise wiped when the ios/
 * directory is regenerated:
 *
 *   0. Removes ORPHAN file references from the app target's
 *      PBXResourcesBuildPhase. Specifically, `@expo/config-plugins`'s
 *      `withSwiftBridgingHeader` (in Swift.js) calls
 *      `addResourceFileToGroup({ isBuildFile: false })` for the
 *      generated `<Project>-Bridging-Header.h` file. Under the hood
 *      `addResourceFileToGroup` unconditionally pushes an entry into
 *      the PBXResourcesBuildPhase files list — but skips creating the
 *      matching PBXBuildFile section entry when `isBuildFile: false`.
 *      Result: the resources phase contains a dangling UUID that has
 *      no matching PBXBuildFile object, which makes the Ruby
 *      `xcodeproj` gem emit this warning during `pod install`:
 *
 *        [!] <PBXResourcesBuildPhase UUID=...> attempted to initialize
 *        an object with an unknown UUID `...` for attribute `files`.
 *
 *      In addition, a bridging header is a compile-time C header, not
 *      a bundle resource — it never belonged in the Resources phase
 *      in the first place (Xcode only reads it via the
 *      `SWIFT_OBJC_BRIDGING_HEADER` build setting). Stripping the
 *      dangling reference removes the warning and matches Xcode's own
 *      behaviour when creating a bridging header manually.
 *
 *      Purely cosmetic on the warning level, but combined with other
 *      output the misleading `[!]` line has repeatedly caused new
 *      developers to abort otherwise-successful `pod install` runs
 *      thinking the build had failed — hence the durable fix.
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
const { withDangerousMod, withXcodeProject } = require('@expo/config-plugins');
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
  let mutated = false;
  if (props['ios.deploymentTarget'] !== '15.0') {
    props['ios.deploymentTarget'] = '15.0';
    mutated = true;
  }
  // Force Old Architecture. app.json also declares `"newArchEnabled": false`
  // but recent Expo SDK 51 patch releases sometimes emit `"true"` here when
  // any hoisted dep advertises Fabric support. Being explicit here prevents
  // the `[CP-User] [RN]Check rncore` codegen step from erroring on clean
  // installs.
  if (props['newArchEnabled'] !== 'false') {
    props['newArchEnabled'] = 'false';
    mutated = true;
  }
  if (mutated) {
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
  // 1) Xcode project mod: strip dangling PBXResourcesBuildPhase entries
  //    that `@expo/config-plugins`' withSwiftBridgingHeader introduces.
  //    Must run AFTER Expo's own xcodeproj mods (Expo registers those
  //    with the same withXcodeProject helper, and mods run in
  //    registration order → this plugin is listed first in
  //    apps/driver/app.json so its callback executes last for the
  //    xcodeproj mod). Idempotent — a no-op once clean.
  config = withXcodeProject(config, (cfg) => {
    cfg.modResults = stripDanglingResources(cfg.modResults);
    return cfg;
  });

  // 2) Podfile / Podfile.properties.json mods (see file header).
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

/**
 * Remove any file reference in a PBXResourcesBuildPhase whose UUID
 * has no matching PBXBuildFile section entry. Dangling references
 * only occur when a config plugin (upstream: Expo's Swift bridging
 * header helper) calls `addResourceFileToGroup({ isBuildFile: false })`
 * — the file is written into the resources phase files array without
 * a paired PBXBuildFile object, so the Ruby xcodeproj gem warns on
 * every `pod install`.
 *
 * Bridging headers are compile-time C headers, not runtime resources,
 * so removing them from the Resources phase is the correct behaviour.
 *
 * @param {object} project  xcode npm `pbxProject` instance
 * @returns {object}         the same instance, mutated in place
 */
function stripDanglingResources(project) {
  const objects = project.hash && project.hash.project && project.hash.project.objects;
  if (!objects) return project;
  const resourcesPhases = objects.PBXResourcesBuildPhase || {};
  const buildFileSection = objects.PBXBuildFile || {};

  for (const key of Object.keys(resourcesPhases)) {
    if (key.endsWith('_comment')) continue;
    const phase = resourcesPhases[key];
    if (!phase || !Array.isArray(phase.files)) continue;
    const before = phase.files.length;
    phase.files = phase.files.filter((entry) => {
      const uuid = entry && entry.value;
      if (!uuid) return true;
      // Keep the entry only if a paired PBXBuildFile exists.
      return Object.prototype.hasOwnProperty.call(buildFileSection, uuid);
    });
    if (phase.files.length !== before) {
      // eslint-disable-next-line no-console
      console.log(
        `[withCargoOneiOSFixes] stripped ${before - phase.files.length} dangling ` +
          `entr${before - phase.files.length === 1 ? 'y' : 'ies'} from PBXResourcesBuildPhase ${key}`,
      );
    }
  }
  return project;
}
