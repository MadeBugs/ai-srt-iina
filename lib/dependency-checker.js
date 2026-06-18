/**
 * Dependency Checker Module
 *
 * Checks for required binaries (whisper-cpp, ffmpeg) and model file presence.
 * Designed to be testable with injected environment mocks.
 *
 * @module dependency-checker
 */

/** Default model download URL for user guidance */
var DEFAULT_MODEL_URL = "https://huggingface.co/Pomni/whisper-small.en-ggml-allquants/resolve/main/ggml-small.en-q8_0.bin";

/**
 * Create the default environment wrapper around IINA APIs.
 * Access is lazy so it only runs inside IINA context.
 *
 * @returns {Object} env object with fileInPath, resolvePath, fileExists, homeDir
 */
function getDefaultEnv() {
  return {
    fileInPath: function (name) {
      if (typeof iina !== "undefined" && iina.utils && iina.utils.fileInPath) {
        return iina.utils.fileInPath(name);
      }
      return false;
    },
    resolvePath: function (p) {
      if (typeof iina !== "undefined" && iina.utils && iina.utils.resolvePath) {
        return iina.utils.resolvePath(p);
      }
      return null;
    },
    fileExists: function (p) {
      if (typeof iina !== "undefined" && iina.file && iina.file.access) {
        try {
          iina.file.access(p);
          return true;
        } catch (e) {
          return false;
        }
      }
      return false;
    },
    homeDir: function () {
      if (typeof iina !== "undefined" && iina.utils && iina.utils.getHomeDir) {
        return iina.utils.getHomeDir();
      }
      return "";
    },
  };
}

/**
 * Expand ~ in a path to the user's home directory.
 *
 * @param {string} path - Path that may start with ~
 * @param {Function} getHomeDir - Function that returns home directory path
 * @returns {string} Expanded path
 */
function expandHome(path, getHomeDir) {
  if (path && path.charAt(0) === "~") {
    var home = getHomeDir();
    if (home) {
      return home + path.substring(1);
    }
  }
  return path;
}

/**
 * Common Homebrew binary paths (Apple Silicon and Intel).
 * IINA's plugin sandbox may not include these in PATH.
 */
var HOME_BREW_PATHS = [
  "/opt/homebrew/bin/",   // Apple Silicon
  "/usr/local/bin/",      // Intel
];

/**
 * Check if the whisper-cpp binary is available in PATH or
 * common Homebrew locations. Checks "whisper-cli" (Homebrew
 * formula name) first, then "whisper-cpp" (source build / alias).
 *
 * @param {Object} [env] - Optional environment override
 * @param {Function} env.fileInPath - Function to check if binary is in PATH
 * @param {Function} env.fileExists - Function to check if file exists at a given path
 * @returns {{ found: boolean, binary: string|null, path: string|null }}
 */
function checkWhisperBinary(env) {
  env = env || getDefaultEnv();
  var binaries = ["whisper-cli", "whisper-cpp"];

  // First try PATH lookup
  for (var i = 0; i < binaries.length; i++) {
    if (env.fileInPath(binaries[i])) {
      return { found: true, binary: binaries[i], path: binaries[i] };
    }
  }

  // Fallback: check common Homebrew paths directly (IINA may not have
  // /opt/homebrew/bin in its PATH)
  for (var b = 0; b < binaries.length; b++) {
    for (var p = 0; p < HOME_BREW_PATHS.length; p++) {
      var fullPath = HOME_BREW_PATHS[p] + binaries[b];
      if (env.fileExists(fullPath)) {
        return { found: true, binary: binaries[b], path: fullPath };
      }
    }
  }

  return { found: false, binary: null, path: null };
}

/**
 * Check if ffmpeg is available in PATH.
 *
 * @param {Object} [env] - Optional environment override
 * @param {Function} env.fileInPath - Function to check if binary is in PATH
 * @returns {{ found: boolean }}
 */
function checkFFmpeg(env) {
  env = env || getDefaultEnv();
  return { found: env.fileInPath("ffmpeg") };
}

/**
 * Search for the whisper model file in standard locations.
 * Search order:
 *   1. ~/.cache/whisper-cpp/models/ggml-small.en-q8_0.bin
 *   2. ./models/ggml-small.en-q8_0.bin (relative to cwd)
 *   3. IINA plugin data dir (@data/models/ggml-small.en-q8_0.bin)
 *
 * @param {Object} [env] - Optional environment override
 * @param {Function} env.fileExists - Function to check file existence
 * @param {Function} env.resolvePath - IINA resolvePath for @data paths
 * @param {Function} env.homeDir - Function returning home directory
 * @returns {{ found: boolean, path: string|null }}
 */
function findModelFile(env) {
  env = env || getDefaultEnv();
  var modelFilename = "ggml-small.en-q8_0.bin";
  var searchPaths = [
    expandHome("~/.cache/whisper-cpp/models/" + modelFilename, env.homeDir || env.homeDir),
    "models/" + modelFilename,
  ];
  if (env.resolvePath) {
    searchPaths.push(env.resolvePath("@data/models/" + modelFilename));
  }
  for (var i = 0; i < searchPaths.length; i++) {
    if (searchPaths[i] && env.fileExists(searchPaths[i])) {
      return { found: true, path: searchPaths[i] };
    }
  }
  return { found: false, path: null };
}

/**
 * Run all dependency checks and return aggregated result.
 *
 * @param {Object} [env] - Optional environment override
 * @returns {{ whisper: { found: boolean, binary: string|null }, ffmpeg: { found: boolean }, model: { found: boolean, path: string|null }, allReady: boolean }}
 */
function checkAll(env) {
  env = env || getDefaultEnv();
  var whisperResult = checkWhisperBinary(env);
  var ffmpegResult = checkFFmpeg(env);
  var modelResult = findModelFile(env);
  return {
    whisper: whisperResult,
    ffmpeg: ffmpegResult,
    model: modelResult,
    allReady: whisperResult.found && ffmpegResult.found && modelResult.found,
  };
}

module.exports = {
  checkWhisperBinary: checkWhisperBinary,
  checkFFmpeg: checkFFmpeg,
  findModelFile: findModelFile,
  checkAll: checkAll,
  DEFAULT_MODEL_URL: DEFAULT_MODEL_URL,
};
