// Reads the version number in package.json
// Reads the most recent git commit hash.
// Returns the current timestamp.

const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

let VERSION;
let GIT_COMMIT_ID;
let DATE;

function updateInfo() {
    VERSION = JSON.parse(fs.readFileSync("package.json")).version;
    GIT_COMMIT_ID = execSync("git rev-parse HEAD").toString().trim();
    DATE = new Date().toISOString();
}

updateInfo();

module.exports = {
    VERSION: VERSION,
    ID: GIT_COMMIT_ID,
    DATE: DATE,

    // Save the build information to build/esm/src/version.js
    saveESMVersionFile() {
        const outputFile = path.join(__dirname, "build", "esm", "version.js");
        const V = `export const VERSION = '${VERSION}';`;
        const I = `export const ID = '${GIT_COMMIT_ID}';`;
        const D = `export const DATE = '${DATE}';`;
        fs.writeFileSync(outputFile, `${V}\n${I}\n${D}`);
    },

    update: updateInfo,
};
