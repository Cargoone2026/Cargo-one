#!/usr/bin/env node
/**
 * apply-node-modules-fixes — CargoOne workspace postinstall hook.
 *
 * Runs automatically after every `yarn install` at the workspace root
 * (see mobile/package.json > scripts.postinstall).
 *
 * WHY IT EXISTS
 * -------------
 * @react-native-async-storage/async-storage@1.23.1 (Expo SDK 51's
 * canonical version) ships a broken codegenConfig block:
 *
 *   "codegenConfig": {
 *     "name": "rnasyncstorage",
 *     "type": "modules",
 *     "jsSrcsDir": "./src",
 *     ...
 *   }
 *
 * `jsSrcsDir` points at the whole `src/` folder. That folder contains
 * exactly one TurboModule spec (NativeAsyncStorageModule.ts) but also
 * nine plain-TypeScript utility files (helpers.ts, hooks.ts,
 * index.ts, types.ts, RCTAsyncStorage.ts, AsyncStorage.ts,
 * AsyncStorage.native.ts, shouldFallbackToLegacyNativeModule.ts).
 *
 * When React Native 0.74's Codegen (@react-native/codegen@0.74.87)
 * runs during `pod install`, it recursively scans `jsSrcsDir` and
 * tries to parse every .ts file as a TurboModule spec. The plain
 * utility files produce `undefined` AST nodes, causing
 * parsers-commons.js::buildSchemaFromConfigType to crash with:
 *
 *   nodes: [ undefined ]
 *
 * ...which fails the whole `use_react_native!` step of `pod install`.
 *
 * THE FIX
 * -------
 * Delete `codegenConfig` from async-storage's package.json.
 *
 * SAFETY
 * ------
 * Our app.json declares `"newArchEnabled": false` — we deliberately
 * stay on the legacy React Native architecture. async-storage's
 * native iOS module (RNCAsyncStorage.mm) uses the legacy bridge
 * (RCT_EXPORT_MODULE / RCT_EXPORT_METHOD), NOT TurboModules — the
 * codegen output for this package is unused at runtime on old arch.
 * Removing the block is a no-op for our build target.
 *
 * IDEMPOTENCY
 * -----------
 * The script re-reads the file each time, so multiple runs are safe.
 * If the field is already absent it exits cleanly without touching
 * anything.
 *
 * SCOPE
 * -----
 * This script ONLY touches packages we've explicitly verified are
 * safe to modify for the current build target. Any addition here
 * must be documented with (a) the exact upstream bug, (b) the
 * safety justification for our arch, and (c) an idempotency check.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const workspaceRoot = path.resolve(__dirname, '..');
let fixed = 0;

// Candidate node_modules locations under a yarn workspace: root and
// per-app hoisted trees. Only the root ever gets used because we
// enable Yarn workspaces, but check both defensively so per-app
// installs (`cd apps/customer && yarn install`) also work.
const candidateRoots = [
  path.join(workspaceRoot, 'node_modules'),
  path.join(workspaceRoot, 'apps', 'customer', 'node_modules'),
  path.join(workspaceRoot, 'apps', 'driver', 'node_modules'),
];

function stripAsyncStorageCodegen(nodeModulesDir) {
  const pkgPath = path.join(
    nodeModulesDir,
    '@react-native-async-storage',
    'async-storage',
    'package.json',
  );
  if (!fs.existsSync(pkgPath)) return;
  const raw = fs.readFileSync(pkgPath, 'utf8');
  const pkg = JSON.parse(raw);
  if (!pkg.codegenConfig) return; // already fixed / not applicable
  delete pkg.codegenConfig;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  const rel = path.relative(workspaceRoot, pkgPath);
  console.log(`[cargoone-postinstall] stripped codegenConfig from ${rel}`);
  fixed += 1;
}

// ---------------------------------------------------------------------------
// expo-device@6.0.2 · UIDevice.swift · TARGET_OS_SIMULATOR
// ---------------------------------------------------------------------------
// UIDevice.swift line 188 reads `return TARGET_OS_SIMULATOR != 0`, which
// dereferences the C preprocessor macro `TARGET_OS_SIMULATOR` inside Swift.
// Xcode 16 / Swift 5.10 no longer imports that macro implicitly, so the
// compile fails with:
//   UIDevice.swift:188:12: error: cannot find 'TARGET_OS_SIMULATOR' in scope
// The upstream fix landed in expo-device 7.x (Expo SDK 52). On SDK 51 the
// recommended workaround is to swap the macro for Swift's native
// `#if targetEnvironment(simulator)` compile-time check — equivalent
// semantics, no behavioural change.
function patchExpoDeviceSimulator(nodeModulesDir) {
  const swiftPath = path.join(
    nodeModulesDir,
    'expo-device',
    'ios',
    'UIDevice.swift',
  );
  if (!fs.existsSync(swiftPath)) return;
  const original = fs.readFileSync(swiftPath, 'utf8');
  const marker = 'return TARGET_OS_SIMULATOR != 0';
  if (!original.includes(marker)) return; // already patched or upstream fixed
  const replacement = [
    '#if targetEnvironment(simulator)',
    '    return true',
    '    #else',
    '    return false',
    '    #endif',
  ].join('\n    ');
  const patched = original.replace(marker, replacement);
  fs.writeFileSync(swiftPath, patched);
  const rel = path.relative(workspaceRoot, swiftPath);
  console.log(`[cargoone-postinstall] patched TARGET_OS_SIMULATOR in ${rel}`);
  fixed += 1;
}

// ---------------------------------------------------------------------------
// expo-dev-menu (SDK 51 canonical) · Swift files · TARGET_IPHONE_SIMULATOR
// ---------------------------------------------------------------------------
// Older expo-dev-menu code paths reference the C preprocessor symbol
// `TARGET_IPHONE_SIMULATOR` inside Swift (`let isSimulator = TARGET_IPHONE_SIMULATOR > 0`).
// Xcode 16 / Swift 5.10 no longer imports that macro implicitly, so the
// compile fails with:
//   error: cannot find 'TARGET_IPHONE_SIMULATOR' in scope
// The upstream fix landed in expo-dev-menu 6.x (Expo SDK 52). On SDK 51 the
// recommended workaround is to replace the C macro usage with Swift's native
// `targetEnvironment(simulator)` compile-time check — equivalent semantics.
//
// We scan every .swift file in the package's ios/ tree (the exact filename
// has drifted between SDK 51 patch releases) and rewrite two known shapes:
//   1) `let X = TARGET_IPHONE_SIMULATOR > 0`
//   2) `TARGET_IPHONE_SIMULATOR != 0`
// Both are replaced with a `#if targetEnvironment(simulator)` block so
// consumers of the Bool see the same value.
function patchExpoDevMenuSimulator(nodeModulesDir) {
  const iosDir = path.join(nodeModulesDir, 'expo-dev-menu', 'ios');
  if (!fs.existsSync(iosDir)) return;

  function walk(dir) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...walk(full));
      else if (entry.isFile() && entry.name.endsWith('.swift')) out.push(full);
    }
    return out;
  }

  const replacement = [
    '{',
    '#if targetEnvironment(simulator)',
    '    true',
    '#else',
    '    false',
    '#endif',
    '}()',
  ].join('\n    ');

  for (const swiftPath of walk(iosDir)) {
    const original = fs.readFileSync(swiftPath, 'utf8');
    if (!original.includes('TARGET_IPHONE_SIMULATOR')) continue;

    // Shape 1:  let <name> = TARGET_IPHONE_SIMULATOR > 0
    let patched = original.replace(
      /=\s*TARGET_IPHONE_SIMULATOR\s*>\s*0/g,
      `= ${replacement}`,
    );
    // Shape 2:  return TARGET_IPHONE_SIMULATOR != 0
    patched = patched.replace(
      /TARGET_IPHONE_SIMULATOR\s*!=\s*0/g,
      replacement,
    );

    if (patched === original) continue; // pattern absent / already fixed
    fs.writeFileSync(swiftPath, patched);
    const rel = path.relative(workspaceRoot, swiftPath);
    console.log(`[cargoone-postinstall] patched TARGET_IPHONE_SIMULATOR in ${rel}`);
    fixed += 1;
  }
}

for (const root of candidateRoots) {
  stripAsyncStorageCodegen(root);
  patchExpoDeviceSimulator(root);
  patchExpoDevMenuSimulator(root);
}
if (fixed === 0) {
  console.log(
    '[cargoone-postinstall] all node_modules fixes already applied — nothing to do',
  );
}
