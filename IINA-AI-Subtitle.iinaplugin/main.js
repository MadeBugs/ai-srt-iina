/**
 * IINA AI Subtitle Plugin - Main Entry
 *
 * Provides AI-powered subtitle generation using local whisper.cpp.
 * Runs in IINA's JavaScriptCore environment (no Node.js/browser APIs).
 *
 * @module main
 */

var core = iina.core;
var event = iina.event;
var menu = iina.menu;
var utils = iina.utils;
var console = iina.console;

var depChecker = require("./lib/dependency-checker.js");
var cacheMgr = require("./lib/cache-manager.js");
var progressParser = require("./lib/progress-parser.js");
var subtitleGen = require("./lib/subtitle-generator.js");

/**
 * Get the currently playing video URL from IINA.
 *
 * @returns {string|null} File URL or null if nothing playing
 */
function getCurrentVideoUrl() {
  try {
    return core.status.url || null;
  } catch (e) {
    return null;
  }
}

/**
 * Show a message on the OSD display.
 *
 * @param {string} msg - Message to display
 */
function showOSD(msg) {
  try {
    if (core.window && core.window.loaded) {
      core.osd(msg);
    }
  } catch (e) {
    console.log("OSD error: " + e.message);
  }
}

/**
 * Handle the "Generate Subtitle" menu action.
 * Orchestrates the full subtitle generation flow.
 */
function handleGenerate() {
  var videoUrl = getCurrentVideoUrl();

  if (!videoUrl) {
    showOSD("No video playing");
    return;
  }

  var videoInfo = cacheMgr.getVideoInfo(videoUrl);

  if (!cacheMgr.isValidVideoExtension(videoInfo.ext)) {
    showOSD("Unsupported video format: " + videoInfo.ext);
    return;
  }

  // Check dependencies
  var deps = depChecker.checkAll();

  if (!deps.whisper.found) {
    utils.ask("Whisper engine not found. Install: brew install whisper-cpp");
    return;
  }

  if (!deps.ffmpeg.found) {
    utils.ask("ffmpeg not found. Install: brew install ffmpeg");
    return;
  }

  if (!deps.model.found) {
    utils.ask(
      "Model ggml-small.en.bin not found.\n" +
      "Download from:\n" +
      depChecker.DEFAULT_MODEL_URL
    );
    return;
  }

  // Check for existing cache
  var cachePath = cacheMgr.getCachePath(videoInfo.fullPath);

  if (cacheMgr.cacheExists(cachePath)) {
    utils.ask("Cache found. Load existing subtitle?",
      function (ok) {
        if (ok) {
          handleLoadCache();
        } else {
          runGeneration(videoInfo.fullPath, deps.model.path, cachePath);
        }
      }
    );
    return;
  }

  runGeneration(videoInfo.fullPath, deps.model.path, cachePath);
}

/**
 * Execute the subtitle generation pipeline.
 *
 * @param {string} videoPath - Full path to the video
 * @param {string} modelPath - Path to the whisper model
 * @param {string} cachePath - Destination SRT path
 */
function runGeneration(videoPath, modelPath, cachePath) {
  showOSD("AI Subtitle: Starting...");

  var tracker = progressParser.createProgressTracker();
  var lastOsdTime = 0;

  subtitleGen.generateSubtitle(videoPath, modelPath, {
    onStatus: function (status) {
      showOSD("AI Subtitle: " + status.message);
    },
    onProgress: function (line) {
      tracker.handleStderrLine(line);
      var status = tracker.getStatus();
      // Throttle OSD updates to avoid flooding (every 500ms)
      var now = Date.now();
      if (now - lastOsdTime > 500) {
        lastOsdTime = now;
        showOSD("AI Subtitle: " + status.message);
      }
    },
  }).then(function (result) {
    if (result.success) {
      showOSD("Subtitle generated! Loading...");

      if (core.subtitle && core.subtitle.loadTrack) {
        core.subtitle.loadTrack(result.srtPath);
      }

      // Brief delay then mark as ready
      setTimeout(function () {
        showOSD("AI Subtitle: Ready");
      }, 1000);
    } else {
      handleGenerationError(result.code, result.error);
    }
  }).catch(function (err) {
    handleGenerationError(null, err.message || String(err));
  });
}

/**
 * Map error codes to user-friendly messages and display them.
 *
 * @param {string} code - Error code constant
 * @param {string} fallbackMsg - Fallback error message
 */
function handleGenerationError(code, fallbackMsg) {
  var message;

  switch (code) {
    case subtitleGen.ERR_FFMPEG_NOT_FOUND:
      message = "ffmpeg not found. Install: brew install ffmpeg";
      break;
    case subtitleGen.ERR_WHISPER_NOT_FOUND:
      message = "Whisper engine not found. Install: brew install whisper-cpp";
      break;
    case subtitleGen.ERR_MODEL_NOT_FOUND:
      message = "Model file not found.\nDownload from:\n" + depChecker.DEFAULT_MODEL_URL;
      break;
    case subtitleGen.ERR_AUDIO_EXTRACTION:
      message = "Failed to extract audio from video.";
      break;
    case subtitleGen.ERR_TRANSCRIPTION:
      message = "Transcription failed. Check whisper setup.";
      break;
    case subtitleGen.ERR_FILE_WRITE:
      message = "Failed to write subtitle file.";
      break;
    case subtitleGen.ERR_CANCELLED:
      message = "Subtitle generation cancelled.";
      break;
    default:
      message = fallbackMsg || "An unknown error occurred.";
      break;
  }

  utils.ask("AI Subtitle Error:\n" + message);
}

/**
 * Handle the "Load Cached Subtitle" menu action.
 * Loads existing {video}.ai.srt if it exists.
 */
function handleLoadCache() {
  var videoUrl = getCurrentVideoUrl();

  if (!videoUrl) {
    showOSD("No video playing");
    return;
  }

  var videoInfo = cacheMgr.getVideoInfo(videoUrl);
  var cachePath = cacheMgr.getCachePath(videoInfo.fullPath);

  if (cacheMgr.cacheExists(cachePath)) {
    if (core.subtitle && core.subtitle.loadTrack) {
      core.subtitle.loadTrack(cachePath);
      showOSD("AI Subtitle: Cached subtitle loaded");
    }
  } else {
    showOSD("No cached subtitle found.");
  }
}

// ---------------------------------------------------------------------------
// Menu Setup
// ---------------------------------------------------------------------------
var subMenu = menu.item("AI Subtitle");
subMenu.addSubMenuItem(
  menu.item("Generate Subtitle", handleGenerate, { keyBinding: "Ctrl+Shift+G" })
);
subMenu.addSubMenuItem(
  menu.item("Load Cached Subtitle", handleLoadCache, { keyBinding: "Ctrl+Shift+L" })
);
menu.addItem(subMenu);

module.exports = {};
