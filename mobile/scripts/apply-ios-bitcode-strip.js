#!/usr/bin/env node
// Adds the CargoOne bitcode-strip step to apps/<app>/ios/Podfile (ios/ is gitignored,
// so this patches the local file). Idempotent. Then run pod install as usual.
// Usage (from mobile/): node scripts/apply-ios-bitcode-strip.js customer|driver
const fs = require("fs");
const path = require("path");
const { ensurePodfileBitcodeStrip } = require("../plugins/withCargoOneiOSFixes");

const app = process.argv[2];
if (!["customer", "driver"].includes(app)) {
  console.error("Usage: node scripts/apply-ios-bitcode-strip.js customer|driver");
  process.exit(1);
}
const iosDir = path.join(__dirname, "..", "apps", app, "ios");
const podfile = path.join(iosDir, "Podfile");
if (!fs.existsSync(podfile)) {
  console.error(`No Podfile at ${podfile}`);
  process.exit(1);
}
ensurePodfileBitcodeStrip(iosDir);
const ok = fs.readFileSync(podfile, "utf8").includes("# BEGIN CargoOne strip bitcode");
console.log(ok ? `Bitcode strip step present in ${podfile}` : "Could not find post_install in Podfile — not patched");
process.exit(ok ? 0 : 1);
