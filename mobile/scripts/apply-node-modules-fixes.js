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

for (const root of candidateRoots) stripAsyncStorageCodegen(root);
if (fixed === 0) {
  console.log(
    '[cargoone-postinstall] async-storage codegenConfig already absent — nothing to do',
  );
}
