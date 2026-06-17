/**
 * Cache Manager Module
 *
 * Handles video file info parsing, cache path computation, and
 * cache existence checks for the IINA AI Subtitle plugin.
 *
 * @module cache-manager
 */

/** Supported video file extensions */
var SUPPORTED_EXTENSIONS = ["mp4", "mkv", "mov", "avi", "webm", "m4v"];

/**
 * Strip the file:// scheme prefix from a URL if present.
 *
 * @param {string} url - File URL or raw path
 * @returns {string} Path without file:// prefix
 */
function stripFileScheme(url) {
  if (typeof url !== "string") return "";
  if (url.indexOf("file://") === 0) {
    return url.substring(7);
  }
  return url;
}

/**
 * Get the last path component (filename with extension).
 *
 * @param {string} path - Full path
 * @returns {string} Filename with extension
 */
function getFilename(path) {
  if (typeof path !== "string") return "";
  var idx = path.lastIndexOf("/");
  if (idx >= 0) {
    return path.substring(idx + 1);
  }
  return path;
}

/**
 * Get the directory portion of a path.
 *
 * @param {string} path - Full path
 * @returns {string} Directory path
 */
function getDir(path) {
  if (typeof path !== "string") return "";
  var idx = path.lastIndexOf("/");
  if (idx >= 0) {
    return path.substring(0, idx);
  }
  return "";
}

/**
 * Get the file extension (without dot, lowercase).
 *
 * @param {string} filename - Filename with extension
 * @returns {string} Extension in lowercase
 */
function getExtension(filename) {
  if (typeof filename !== "string") return "";
  var dotIdx = filename.lastIndexOf(".");
  if (dotIdx >= 0 && dotIdx < filename.length - 1) {
    return filename.substring(dotIdx + 1).toLowerCase();
  }
  return "";
}

/**
 * Get the basename (filename without extension).
 *
 * @param {string} filename - Filename with extension
 * @returns {string} Filename without extension
 */
function getBasename(filename) {
  if (typeof filename !== "string") return "";
  var dotIdx = filename.lastIndexOf(".");
  if (dotIdx > 0) {
    return filename.substring(0, dotIdx);
  }
  return filename;
}

/**
 * Parse video file information from a file URL or path.
 *
 * @param {string} url - File URL (file:///...) or raw path
 * @returns {{ fullPath: string, dir: string, basename: string, ext: string, filename: string }}
 */
function getVideoInfo(url) {
  var fullPath = stripFileScheme(url);
  var filename = getFilename(fullPath);
  return {
    fullPath: fullPath,
    dir: getDir(fullPath),
    filename: filename,
    basename: getBasename(filename),
    ext: getExtension(filename),
  };
}

/**
 * Compute the cache subtitle path for a given video path.
 * Cache is named {basename}.ai.srt in the same directory as the video.
 *
 * @param {string} videoPath - Full path to the video file
 * @returns {string} Path to the cache subtitle file
 */
function getCachePath(videoPath) {
  var info = getVideoInfo(videoPath);
  if (!info.dir) {
    // Root path like "/movie.mp4" -> dir is ""; preserve leading slash
    if (info.fullPath && info.fullPath.charAt(0) === "/" && info.fullPath.indexOf("/", 1) < 0) {
      return "/" + info.basename + ".ai.srt";
    }
    return info.basename + ".ai.srt";
  }
  return info.dir + "/" + info.basename + ".ai.srt";
}

/**
 * Check if a cache file exists at the given path.
 *
 * @param {string} cachePath - Path to the cache file
 * @param {Function} [fileExists] - Optional callback to check file existence
 * @returns {boolean} Whether the file exists
 */
function cacheExists(cachePath, fileExists) {
  if (!cachePath) return false;
  if (fileExists) {
    return fileExists(cachePath);
  }
  return false;
}

/**
 * Check if a file extension is a supported video format.
 * Case-insensitive and handles both ".mp4" and "mp4" formats.
 *
 * @param {string} ext - File extension (with or without leading dot)
 * @returns {boolean} Whether the extension is supported
 */
function isValidVideoExtension(ext) {
  if (typeof ext !== "string") return false;
  var normalized = ext.toLowerCase();
  if (normalized.charAt(0) === ".") {
    normalized = normalized.substring(1);
  }
  for (var i = 0; i < SUPPORTED_EXTENSIONS.length; i++) {
    if (normalized === SUPPORTED_EXTENSIONS[i]) {
      return true;
    }
  }
  return false;
}

module.exports = {
  SUPPORTED_EXTENSIONS: SUPPORTED_EXTENSIONS,
  getVideoInfo: getVideoInfo,
  getCachePath: getCachePath,
  cacheExists: cacheExists,
  isValidVideoExtension: isValidVideoExtension,
};
