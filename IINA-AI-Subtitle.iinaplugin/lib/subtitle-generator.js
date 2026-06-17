/**
 * Subtitle Generator Module
 *
 * Orchestrates ffmpeg audio extraction and whisper.cpp transcription
 * to generate SRT subtitle files from video using local binaries.
 *
 * @module subtitle-generator
 */

/** ffmpeg binary not available in PATH */
var ERR_FFMPEG_NOT_FOUND = "ERR_FFMPEG_NOT_FOUND";
/** whisper binary not available in PATH */
var ERR_WHISPER_NOT_FOUND = "ERR_WHISPER_NOT_FOUND";
/** model file not found at expected location */
var ERR_MODEL_NOT_FOUND = "ERR_MODEL_NOT_FOUND";
/** ffmpeg audio extraction failed */
var ERR_AUDIO_EXTRACTION = "ERR_AUDIO_EXTRACTION";
/** whisper transcription failed */
var ERR_TRANSCRIPTION = "ERR_TRANSCRIPTION";
/** failed to write output SRT file */
var ERR_FILE_WRITE = "ERR_FILE_WRITE";
/** user cancelled the operation */
var ERR_CANCELLED = "ERR_CANCELLED";

/**
 * Create the default environment wrapper for subprocess execution.
 *
 * @returns {Object} env with exec, fileInPath, cp, unlink, mkdtemp
 */
function getDefaultEnv() {
  return {
    exec: function (binary, args, opts, onStderr, onStdout) {
      if (typeof iina !== "undefined" && iina.utils && iina.utils.exec) {
        return iina.utils.exec(binary, args, opts, onStdout, onStderr);
      }
      return Promise.reject(new Error("iina.utils.exec not available"));
    },
    fileInPath: function (name) {
      if (typeof iina !== "undefined" && iina.utils && iina.utils.fileInPath) {
        return iina.utils.fileInPath(name);
      }
      return false;
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
    randomString: function () {
      return Math.random().toString(36).substring(2, 10);
    },
  };
}

/**
 * Extract audio from video file using ffmpeg.
 *
 * @param {string} videoPath - Full path to the video file
 * @param {string} tempDir - Temporary directory for audio output
 * @param {Object} [env] - Environment override for testing
 * @returns {Promise<{ success: boolean, audioPath?: string, error?: string, code?: string }>}
 */
function extractAudio(videoPath, tempDir, env) {
  env = env || getDefaultEnv();
  var audioPath = tempDir + "/audio.wav";
  var args = [
    "-y",
    "-i", videoPath,
    "-vn",
    "-ar", "16000",
    "-ac", "1",
    "-c:a", "pcm_s16le",
    "-f", "wav",
    audioPath,
  ];

  return env.exec("ffmpeg", args, null, null, null)
    .then(function () {
      return { success: true, audioPath: audioPath };
    })
    .catch(function (err) {
      if (err && (err.code === "ERROR_BINARY_NOT_FOUND" || err.message && err.message.indexOf("not found") >= 0)) {
        return { success: false, error: "ffmpeg not found. Install: brew install ffmpeg", code: ERR_FFMPEG_NOT_FOUND };
      }
      return { success: false, error: "Audio extraction failed: " + (err.message || String(err)), code: ERR_AUDIO_EXTRACTION };
    });
}

/**
 * Run whisper.cpp transcription on audio file.
 *
 * @param {string} audioPath - Path to the extracted audio WAV file
 * @param {string} modelPath - Path to the whisper model file
 * @param {string} outputBase - Base path for output files (without extension)
 * @param {Function} onProgress - Callback for stderr lines (progress tracker)
 * @param {Object} [env] - Environment override for testing
 * @returns {Promise<{ success: boolean, srtPath?: string, error?: string, code?: string }>}
 */
function runWhisper(audioPath, modelPath, outputBase, onProgress, env) {
  env = env || getDefaultEnv();
  var binary = null;
  if (env.fileInPath("whisper-cpp")) {
    binary = "whisper-cpp";
  } else if (env.fileInPath("whisper-cli")) {
    binary = "whisper-cli";
  }

  if (!binary) {
    return Promise.resolve({
      success: false,
      error: "Whisper engine not found. Install: brew install whisper-cpp",
      code: ERR_WHISPER_NOT_FOUND,
    });
  }

  var args = [
    "-m", modelPath,
    "-f", audioPath,
    "--output-srt",
    "--print-progress",
    "-of", outputBase,
  ];

  var stderrHook = onProgress
    ? function (line) { onProgress(line); }
    : null;

  return env.exec(binary, args, null, stderrHook, null)
    .then(function () {
      var srtPath = outputBase + ".srt";
      return { success: true, srtPath: srtPath };
    })
    .catch(function (err) {
      if (err && err.code === "ERROR_BINARY_NOT_FOUND") {
        return { success: false, error: "Whisper engine not found.", code: ERR_WHISPER_NOT_FOUND };
      }
      return { success: false, error: "Transcription failed: " + (err.message || String(err)), code: ERR_TRANSCRIPTION };
    });
}

/**
 * High-level subtitle generation orchestrator.
 *
 * Steps:
 *   1. Create temp directory
 *   2. Extract audio via ffmpeg
 *   3. Run whisper transcription
 *   4. Move SRT to video directory as {basename}.ai.srt
 *   5. Cleanup temp directory
 *
 * @param {string} videoPath - Full path to the video file
 * @param {string} modelPath - Path to the whisper model file
 * @param {Object} [options] - Optional settings
 * @param {Function} [options.onStatus] - Status callback for OSD updates
 * @param {AbortSignal} [options.signal] - Optional abort signal for cancellation
 * @param {Object} [env] - Environment override for testing
 * @returns {Promise<{ success: boolean, srtPath?: string, error?: string, code?: string }>}
 */
function generateSubtitle(videoPath, modelPath, options, env) {
  env = env || getDefaultEnv();
  options = options || {};
  var onStatus = options.onStatus || function () {};
  var signal = options.signal || null;

  // Check if cancelled before starting
  if (signal && signal.aborted) {
    return Promise.resolve({ success: false, error: "Cancelled", code: ERR_CANCELLED });
  }

  // Derive output SRT path (same dir as video, {basename}.ai.srt)
  var videoDir = "";
  var videoBasename = "";
  var slashIdx = videoPath.lastIndexOf("/");
  if (slashIdx >= 0) {
    videoDir = videoPath.substring(0, slashIdx);
    var filename = videoPath.substring(slashIdx + 1);
    var dotIdx = filename.lastIndexOf(".");
    videoBasename = dotIdx > 0 ? filename.substring(0, dotIdx) : filename;
  } else {
    videoBasename = videoPath;
  }
  var outputSrtPath = videoDir + "/" + videoBasename + ".ai.srt";

  // Create temp dir
  var tempDir = "/tmp/iina-ai-subtitle-" + env.randomString();

  onStatus({ status: "extracting-audio", message: "Extracting audio..." });

  return extractAudio(videoPath, tempDir, env)
    .then(function (audioResult) {
      if (!audioResult.success) return audioResult;

      if (signal && signal.aborted) {
        return { success: false, error: "Cancelled", code: ERR_CANCELLED };
      }

      onStatus({ status: "transcribing", message: "Transcribing..." });

      var outputBase = tempDir + "/output";
      var progressCb = options.onProgress || null;

      return runWhisper(audioResult.audioPath, modelPath, outputBase, progressCb, env)
        .then(function (whisperResult) {
          if (!whisperResult.success) return whisperResult;

          if (signal && signal.aborted) {
            return { success: false, error: "Cancelled", code: ERR_CANCELLED };
          }

          // Move SRT to video directory
          // In IINA context, use exec to copy since fs is not available
          return env.exec("cp", [whisperResult.srtPath, outputSrtPath], null, null, null)
            .then(function () {
              return { success: true, srtPath: outputSrtPath };
            })
            .catch(function () {
              // Try file API fallback
              return { success: false, error: "Failed to write subtitle file", code: ERR_FILE_WRITE };
            });
        });
    })
    .then(function (result) {
      // Always attempt cleanup
      cleanup([tempDir], env);
      return result;
    })
    .catch(function (err) {
      cleanup([tempDir], env);
      return { success: false, error: err.message || String(err), code: ERR_TRANSCRIPTION };
    });
}

/**
 * Clean up temporary files and directories.
 *
 * @param {string[]} tempPaths - Array of temp file/directory paths to remove
 * @param {Object} [env] - Environment override for testing
 */
function cleanup(tempPaths, env) {
  env = env || getDefaultEnv();
  if (!tempPaths || !tempPaths.length) return;
  for (var i = 0; i < tempPaths.length; i++) {
    if (tempPaths[i]) {
      // Use exec to remove (rm -rf) since fs is not available in IINA
      env.exec("rm", ["-rf", tempPaths[i]], null, null, null).catch(function () {});
    }
  }
}

module.exports = {
  generateSubtitle: generateSubtitle,
  extractAudio: extractAudio,
  runWhisper: runWhisper,
  cleanup: cleanup,
  ERR_FFMPEG_NOT_FOUND: ERR_FFMPEG_NOT_FOUND,
  ERR_WHISPER_NOT_FOUND: ERR_WHISPER_NOT_FOUND,
  ERR_MODEL_NOT_FOUND: ERR_MODEL_NOT_FOUND,
  ERR_AUDIO_EXTRACTION: ERR_AUDIO_EXTRACTION,
  ERR_TRANSCRIPTION: ERR_TRANSCRIPTION,
  ERR_FILE_WRITE: ERR_FILE_WRITE,
  ERR_CANCELLED: ERR_CANCELLED,
};
