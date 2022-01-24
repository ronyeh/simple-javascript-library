const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawnSync } = require("child_process");

const webpack = require("webpack");
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

function webpackConfigs() {
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

    function prodConfig() {
        return getConfig(PRODUCTION_MODE, "SimpleJSLib");
    }

    function debugConfig() {
        return getConfig(DEVELOPMENT_MODE, "SimpleJSLib");
    }

    return {
        // grunt webpack:prodAndDebug
        prodAndDebug: () => [prodConfig(), debugConfig()],
    };
}

module.exports = (grunt) => {
    const log = grunt.log.writeln;

    grunt.initConfig({
        pkg: grunt.file.readJSON("package.json"),
        webpack: webpackConfigs(),
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
        spawnSync("cp", ["-r", "src", "build/esm/"], { stdio: "inherit" });
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
            // verbose: 1, // See the output of each hook.
            // verbose: 2, // Only for debugging.
            hooks: {
                "before:init": ["grunt clean"],
                "after:bump": ["grunt", "echo Adding build/ folder...", "git add -f build/", "git commit -m 'Add build/ for release version ${version}.'"],
                "after:npm:release": ["echo COMPLETE: Published to npm."],
                "after:git:release": ["echo COMPLETE: Committed to git repository."],
                "after:github:release": ["echo COMPLETE: Released to GitHub."],
                "after:release": [
                    "echo Removing build/ folder...",
                    "git rm -rf build/",
                    "git commit -m 'Remove build/ after releasing version ${version}.'",
                    "git push",
                    "echo Successfully released ${name} ${version} to https://github.com/${repo.repository}",
                ],
            },
            git: {
                changelog: false,
                commitMessage: "Release ${version}",
                requireCleanWorkingDir: true,
                commit: true,
                tag: true,
                push: true,
            },
            github: { release: true },
            npm: { publish: true },
        };

        if (args.includes("dry-run")) {
            options["dry-run"] = true;
            console.log("====== DRY RUN MODE ======");
        }
        // Handle preRelease tags: alpha | beta | rc.
        if (args.includes("alpha")) {
            options["preRelease"] = "alpha";
        }
        if (args.includes("beta")) {
            options["preRelease"] = "beta";
        }
        if (args.includes("rc")) {
            options["preRelease"] = "rc";
        }

        release(options).then((output) => {
            done();
        });
    });
};
