const path = require("path");
const fs = require("fs");
const os = require("os");
const { execSync, spawnSync } = require("child_process");

const release = require("release-it");

const versionInfo = require("./version_info");

// Output directories & files.
const BASE_DIR = __dirname;
const BUILD_DIR = path.join(BASE_DIR, "build");
const BUILD_CJS_DIR = path.join(BUILD_DIR, "cjs");
const BUILD_ESM_DIR = path.join(BUILD_DIR, "esm");
const BUILD_ESM_PACKAGE_JSON_FILE = path.join(BUILD_ESM_DIR, "package.json");

const PRODUCTION_MODE = "production";
const DEVELOPMENT_MODE = "development";

// returns a webpack config object.
function getConfig(mode, libraryName) {
    const globalObject = `(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this)`;

    return {
        mode,
        entry: "./src/index.js",
        output: {
            path: BUILD_CJS_DIR,
            filename: "lib.js",
            library: {
                name: libraryName,
                type: "umd",
                export: "default",
            },
            globalObject,
        },
        resolve: { extensions: [".js", "..."] },
        module: {
            rules: [
                {
                    test: /version\.js$/,
                    loader: "string-replace-loader",
                    options: {
                        multiple: [
                            { search: "__VERSION__", replace: versionInfo.VERSION },
                            { search: "__GIT_COMMIT_ID__", replace: versionInfo.ID },
                            { search: "__BUILD_DATE__", replace: versionInfo.DATE },
                        ],
                    },
                },
            ],
        },
    };
}

function runCommand(command, ...args) {
    // The stdio option passes the output from the spawned process back to this process's console.
    spawnSync(command, args, { stdio: "inherit" });
}

module.exports = (grunt) => {
    const log = grunt.log.writeln;

    grunt.initConfig({
        pkg: grunt.file.readJSON("package.json"),
        webpack: {
            prodAndDebug: [
                // grunt webpack:prodAndDebug
                getConfig(PRODUCTION_MODE, "SimpleJSLib"),
                getConfig(DEVELOPMENT_MODE, "SimpleJSLib"),
            ],
        },
        // grunt clean
        // Calls all clean tasks below.
        clean: {
            // grunt clean:build
            build: { src: [BUILD_DIR] },
        },
    });

    grunt.loadNpmTasks("grunt-contrib-clean");
    grunt.loadNpmTasks("grunt-webpack");

    // grunt
    // Build all targets for production and debugging.
    grunt.registerTask("default", "Build all targets.", ["clean", "webpack:prodAndDebug", "build:esm"]);

    // grunt build:esm
    // grunt build:esm:watch
    // Output individual ES module files to build/esm/.
    // Also fixes the imports and exports so that they all end in .js.
    grunt.registerTask("build:esm", "Use tsc to create ES module files in build/esm/", function (arg) {
        log("ESM: Building to ./build/esm/");
        fs.mkdirSync(BUILD_ESM_DIR, { recursive: true });
        execSync("cp ./src/* ./build/esm/");
        // The build/esm/ folder needs a package.json that specifies { "type": "module" }.
        // This indicates that all *.js files in `build/esm/` are ES modules.
        fs.writeFileSync(BUILD_ESM_PACKAGE_JSON_FILE, '{\n  "type": "module"\n}\n');
        versionInfo.update();
        versionInfo.saveESMVersionFile();
    });

    // Release to npm and GitHub.
    // Specify "dry-run" to walk through the release process without actually doing anything.
    // Optionally provide a preRelease tag ( alpha | beta | rc ).
    // Remember to use your GitHub personal access token:
    //   GITHUB_TOKEN=XYZ grunt release
    //   GITHUB_TOKEN=XYZ grunt release:alpha
    //   GITHUB_TOKEN=XYZ grunt release:beta
    //   GITHUB_TOKEN=XYZ grunt release:rc
    //   GITHUB_TOKEN=XYZ grunt release:dry-run
    //   GITHUB_TOKEN=XYZ grunt release:dry-run:alpha
    //   GITHUB_TOKEN=XYZ grunt release:dry-run:beta
    //   GITHUB_TOKEN=XYZ grunt release:dry-run:rc
    grunt.registerTask("release", "Produce the complete build. Release to npm and GitHub.", function (...args) {
        if (!process.env.GITHUB_TOKEN) {
            console.warn("GITHUB_TOKEN environment variable is missing.");
        }

        const done = this.async();

        // See the full list of options at:
        // https://github.com/release-it/release-it
        // https://github.com/release-it/release-it/blob/master/config/release-it.json
        const options = {
            hooks: {
                "before:init": ["grunt clean"],
                "after:bump": ["grunt", "echo Adding build/ folder...", "git add -f build/"],
                "after:npm:release": ["echo COMPLETE: Published to npm."],
                "after:git:release": ["echo COMPLETE: Committed to git repository."],
                "after:github:release": ["echo COMPLETE: Released to GitHub."],
                "after:release": ["echo Successfully released ${name} ${version} to https://github.com/${repo.repository}"],
            },
            git: {
                commitMessage: "Release ${version}",
                changelog: true,
                requireCleanWorkingDir: true,
                commit: true,
                tag: true,
                push: true,
            },
            github: {
                release: true,
            },
            npm: {
                publish: true,
            },
            "disable-metrics": true,
        };

        args.forEach((arg) => {
            if (arg === "dry-run") {
                options["dry-run"] = true;
                log("====== DRY RUN MODE ======");
            } else if (arg === "alpha") {
                // Handle preRelease tag: alpha.
                options["preRelease"] = "alpha";
            } else if (arg === "beta") {
                // Handle preRelease tag: beta.
                options["preRelease"] = "beta";
            } else if (arg === "rc") {
                // Handle preRelease tag: rc.
                options["preRelease"] = "rc";
            } else if (arg.startsWith("verbose")) {
                // verbose: 1, // See the output of each hook.
                // verbose: 2, // Only for debugging.
                const parts = arg.split("=");
                if (parts.length === 2) {
                    const val = parseInt(parts[1]) === 1 ? 1 : 2;
                    options.verbose = val;
                }
            } else if (arg.startsWith("git.")) {
                // Support boolean flags (e.g., git.commit=false).
                const parts = arg.split("=");
                if (parts.length === 2) {
                    const val = parts[1] === "true"; // everything else is false for now.
                    options.git[parts[0].substr(4)] = val;
                }
            } else if (arg.startsWith("github.")) {
                const parts = arg.split("=");
                if (parts.length === 2) {
                    const val = parts[1] === "true"; // everything else is false for now.
                    options.github[parts[0].substr(7)] = val;
                }
            } else if (arg.startsWith("npm.")) {
                const parts = arg.split("=");
                if (parts.length === 2) {
                    const val = parts[1] === "true"; // everything else is false for now.
                    options.npm[parts[0].substr(4)] = val;
                }
            }
        });

        release(options).then((output) => {
            console.log(output);
            try {
                // If the build/ folder is currently checked in to the repo, we remove it.
                log("Removing build/ folder...");
                const hideOutput = { stdio: "pipe" }; // Hide the output of the following two execSync() calls.
                execSync("git show HEAD:build/", hideOutput);
                execSync("git rm -rf build/", hideOutput);
                execSync("git commit -m 'Remove build/ after releasing to npm and GitHub.'");
                runCommand("git", "push");
            } catch (e) {
                // If the build/ folder is not checked in, we do nothing.
            }
            done();
        });
    });
};
