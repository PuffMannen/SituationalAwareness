/**
 * Build the module package and optionally install it into a local Foundry VTT data folder.
 *
 *   node tools/build.mjs           Copy the module files into ./situational-awareness
 *   node tools/build.mjs --deploy  Build, then replace the installed copy in Foundry
 *
 * The Foundry data folder defaults to the macOS desktop app location. Set FOUNDRY_DATA to the
 * folder that contains "Data" to use another one.
 */

import { cpSync, existsSync, readFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const { id: MODULE_ID, version } = JSON.parse(readFileSync(join(ROOT, "module.json"), "utf8"));

/** Files and folders that make up the installed module. */
const PACKAGE_FILES = ["module.json", "scripts", "lang", "templates", "README.md", "CHANGELOG.md", "LICENSE"];

const OUT_DIR = join(ROOT, MODULE_ID);

/**
 * Replace the contents of a module folder with a fresh copy of the package files.
 * @param {string} source    Folder to copy from
 * @param {string} target    Module folder to replace. Its name must be the module id.
 */
function copyPackage(source, target) {
  if ( !target.endsWith(`/${MODULE_ID}`) ) throw new Error(`Refusing to replace ${target}`);
  rmSync(target, {recursive: true, force: true});
  for ( const file of PACKAGE_FILES ) {
    cpSync(join(source, file), join(target, file), {recursive: true});
  }
}

copyPackage(ROOT, OUT_DIR);
console.log(`Built ${MODULE_ID} ${version} in ${OUT_DIR}`);

if ( process.argv.includes("--deploy") ) {
  const dataRoot = process.env.FOUNDRY_DATA ?? join(homedir(), "Library", "Application Support", "FoundryVTT");
  const modulesDir = join(dataRoot, "Data", "modules");
  if ( !existsSync(modulesDir) ) throw new Error(`No Foundry modules folder at ${modulesDir}. Set FOUNDRY_DATA.`);
  const target = join(modulesDir, MODULE_ID);
  copyPackage(OUT_DIR, target);
  console.log(`Deployed to ${target}. Reload the world in each client to load the new code.`);
}
