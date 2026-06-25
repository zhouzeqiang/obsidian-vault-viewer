import { readFileSync, writeFileSync } from "fs";

const targetVersion = process.argv[2];

// read minAppVersion from manifest.json and bump version to target version
let manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const { version } = JSON.parse(readFileSync("package.json", "utf8"));

manifest.version = targetVersion || version;
writeFileSync("manifest.json", JSON.stringify(manifest, null, "\t"));
