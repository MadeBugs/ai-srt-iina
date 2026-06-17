/**
 * Progress Parser Module
 *
 * Parses whisper.cpp --print-progress stderr output and ffmpeg progress lines,
 * providing a real-time progress tracker for OSD feedback.
 *
 * @module progress-parser
 */

/**
 * Parse a single line from whisper.cpp or ffmpeg stderr output.
 *
 * @param {string} line - A line of stderr output
 * @returns {{ type: string, percent: number|null, text: string|null }}
 */
function parseProgressLine(line) {
  if (typeof line !== "string" || line.length === 0) {
    return { type: "other", percent: null, text: null };
  }

  // Detect ffmpeg progress lines (contain "time=" with time format)
  if (line.indexOf("time=") >= 0 && line.indexOf("bitrate=") >= 0) {
    return { type: "ffmpeg", percent: null, text: line };
  }

  // Detect whisper.cpp processing progress lines
  // Format: "main: processing progress:  65%|██████▋   | 98/150 [00:19<00:10,  4.87it/s]"
  var progressMatch = line.match(/(\d+)%\s*\|/);
  if (progressMatch) {
    var percent = parseInt(progressMatch[1], 10);
    if (percent >= 100) {
      return { type: "done", percent: 100, text: line };
    }
    return { type: "progress", percent: percent, text: line };
  }

  // Also check for alternative formats like "whisper_cpp: processing progress:  50%|..."
  var altProgressMatch = line.match(/processing progress:\s*(\d+)%/);
  if (altProgressMatch) {
    var pct = parseInt(altProgressMatch[1], 10);
    if (pct >= 100) {
      return { type: "done", percent: 100, text: line };
    }
    return { type: "progress", percent: pct, text: line };
  }

  // Detect completion markers
  if (line.indexOf("100%") >= 0) {
    return { type: "done", percent: 100, text: line };
  }

  return { type: "other", percent: null, text: line };
}

/**
 * Get the current percentage estimate from a progress state object.
 *
 * @param {Object} progressState - Accumulated progress state
 * @returns {number} Percentage 0-100
 */
function getProgressPercentage(progressState) {
  if (!progressState || typeof progressState.latestPercent !== "number") {
    return 0;
  }
  return progressState.latestPercent;
}

/**
 * Create a progress tracker for monitoring subtitle generation.
 * Tracks state across ffmpeg extraction and whisper transcription phases.
 *
 * @returns {Object} Progress tracker with handleStderrLine, getStatus, and state properties
 */
function createProgressTracker() {
  var state = {
    latestPercent: 0,
    status: "idle",
  };

  /**
   * Build a human-readable status message for OSD display.
   *
   * @returns {string} Status message
   */
  function buildMessage() {
    switch (state.status) {
      case "idle":
        return "Generating subtitle...";
      case "extracting-audio":
        return "Extracting audio...";
      case "transcribing":
        return "Transcribing: " + state.latestPercent + "%";
      case "done":
        return "Done";
      case "error":
        return "Error occurred";
      default:
        return "Processing...";
    }
  }

  return {
    /** Latest progress percentage (0-100) */
    latestPercent: 0,
    /** Current status phase */
    status: "idle",

    /**
     * Process a single stderr line and update tracker state.
     *
     * @param {string} line - Stderr output line
     */
    handleStderrLine: function (line) {
      var parsed = parseProgressLine(line);
      if (parsed.type === "ffmpeg") {
        state.status = "extracting-audio";
      } else if (parsed.type === "progress" && parsed.percent !== null) {
        state.status = "transcribing";
        state.latestPercent = parsed.percent;
        this.latestPercent = parsed.percent;
      } else if (parsed.type === "done") {
        state.status = "done";
        state.latestPercent = 100;
        this.latestPercent = 100;
      }
      this.status = state.status;
    },

    /**
     * Get the current status summary.
     *
     * @returns {{ percent: number, status: string, message: string }}
     */
    getStatus: function () {
      return {
        percent: state.latestPercent,
        status: state.status,
        message: buildMessage(),
      };
    },
  };
}

module.exports = {
  parseProgressLine: parseProgressLine,
  getProgressPercentage: getProgressPercentage,
  createProgressTracker: createProgressTracker,
};
