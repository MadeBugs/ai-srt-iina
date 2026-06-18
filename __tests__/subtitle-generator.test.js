var sg = require("../lib/subtitle-generator.js");

describe("subtitle-generator", function () {
  describe("error code constants", function () {
    it("exports all error code constants", function () {
      expect(sg.ERR_FFMPEG_NOT_FOUND).toBe("ERR_FFMPEG_NOT_FOUND");
      expect(sg.ERR_WHISPER_NOT_FOUND).toBe("ERR_WHISPER_NOT_FOUND");
      expect(sg.ERR_MODEL_NOT_FOUND).toBe("ERR_MODEL_NOT_FOUND");
      expect(sg.ERR_AUDIO_EXTRACTION).toBe("ERR_AUDIO_EXTRACTION");
      expect(sg.ERR_TRANSCRIPTION).toBe("ERR_TRANSCRIPTION");
      expect(sg.ERR_FILE_WRITE).toBe("ERR_FILE_WRITE");
      expect(sg.ERR_CANCELLED).toBe("ERR_CANCELLED");
    });
  });

  describe("extractAudio", function () {
    it("builds correct ffmpeg arguments", function () {
      var capturedArgs = null;
      var mockEnv = {
        exec: function (binary, args) {
          capturedArgs = args;
          return Promise.resolve();
        },
      };

      return sg.extractAudio("/path/video.mp4", "/tmp/test", mockEnv)
        .then(function () {
          expect(capturedArgs).toContain("-y");
          expect(capturedArgs).toContain("-ar");
          expect(capturedArgs).toContain("16000");
          expect(capturedArgs).toContain("-ac");
          expect(capturedArgs).toContain("1");
          expect(capturedArgs).toContain("-c:a");
          expect(capturedArgs).toContain("pcm_s16le");
        });
    });
    it("resolves with success when ffmpeg succeeds", function () {
      var mockEnv = {
        exec: function () {
          return Promise.resolve();
        },
      };

      return sg.extractAudio("/path/video.mp4", "/tmp/test", mockEnv)
        .then(function (result) {
          expect(result.success).toBe(true);
          expect(result.audioPath).toBe("/tmp/test/audio.wav");
        });
    });

    it("returns error when ffmpeg binary is not found", function () {
      var mockEnv = {
        exec: function () {
          return Promise.reject({ code: "ERROR_BINARY_NOT_FOUND", message: "not found" });
        },
      };

      return sg.extractAudio("/path/video.mp4", "/tmp/test", mockEnv)
        .then(function (result) {
          expect(result.success).toBe(false);
          expect(result.code).toBe("ERR_FFMPEG_NOT_FOUND");
        });
    });

    it("returns error when ffmpeg runtime fails", function () {
      var mockEnv = {
        exec: function () {
          return Promise.reject(new Error("ffmpeg failed with code 1"));
        },
      };

      return sg.extractAudio("/path/video.mp4", "/tmp/test", mockEnv)
        .then(function (result) {
          expect(result.success).toBe(false);
          expect(result.code).toBe("ERR_AUDIO_EXTRACTION");
        });
    });
  });

  describe("runWhisper", function () {
    it("resolves with success when whisper succeeds", function () {
      var mockEnv = {
        fileInPath: function () {
          return true;
        },
        fileExists: function () { return true; },
        exec: function (binary, args, opts, onStderr) {
          return Promise.resolve();
        },
      };

      return sg.runWhisper("/tmp/audio.wav", "/model.bin", "/tmp/output", null, mockEnv)
        .then(function (result) {
          expect(result.success).toBe(true);
          expect(result.srtPath).toBe("/tmp/output.srt");
        });
    });

    it("returns error when whisper binary not found", function () {
      var mockEnv = {
        fileInPath: function () {
          return false;
        },
        fileExists: function () {
          return false;
        },
      };

      return sg.runWhisper("/tmp/audio.wav", "/model.bin", "/tmp/output", null, mockEnv)
        .then(function (result) {
          expect(result.success).toBe(false);
          expect(result.code).toBe("ERR_WHISPER_NOT_FOUND");
        });
    });

    it("returns error when whisper runtime fails", function () {
      var mockEnv = {
        fileInPath: function () {
          return true;
        },
        fileExists: function () { return true; },
        exec: function () {
          return Promise.reject(new Error("whisper failed"));
        },
      };

      return sg.runWhisper("/tmp/audio.wav", "/model.bin", "/tmp/output", null, mockEnv)
        .then(function (result) {
          expect(result.success).toBe(false);
          expect(result.code).toBe("ERR_TRANSCRIPTION");
        });
    });

    it("calls onProgress callback for stderr lines", function () {
      var progressLines = [];

      var mockEnv = {
        fileInPath: function () {
          return true;
        },
        fileExists: function () { return true; },
        exec: function (binary, args, opts, onStderr) {
          if (onStderr) {
            onStderr("progress line 1");
            onStderr("progress line 2");
          }
          return Promise.resolve();
        },
      };

      var onProgress = function (line) {
        progressLines.push(line);
      };

      return sg.runWhisper("/tmp/audio.wav", "/model.bin", "/tmp/output", onProgress, mockEnv)
        .then(function () {
          expect(progressLines.length).toBe(2);
          expect(progressLines[0]).toBe("progress line 1");
          expect(progressLines[1]).toBe("progress line 2");
        });
    });
  });

  describe("generateSubtitle", function () {
    it("returns cancelled error when signal is already aborted", function () {
      var mockEnv = { randomString: function () { return "abc123"; }, exec: function () { return Promise.resolve(); } };
      var signal = { aborted: true };

      return sg.generateSubtitle("/path/video.mp4", "/model.bin", { signal: signal }, mockEnv)
        .then(function (result) {
          expect(result.success).toBe(false);
          expect(result.code).toBe("ERR_CANCELLED");
        });
    });

    it("returns error when ffmpeg binary not found during extraction", function () {
      var mockEnv = {
        randomString: function () { return "abc123"; },
        exec: function () {
          return Promise.reject({ code: "ERROR_BINARY_NOT_FOUND", message: "not found" });
        },
      };

      return sg.generateSubtitle("/path/video.mp4", "/model.bin", {}, mockEnv)
        .then(function (result) {
          expect(result.success).toBe(false);
          expect(result.code).toBe("ERR_FFMPEG_NOT_FOUND");
        });
    });

    it("returns error when whisper binary not found", function () {
      var envCalls = 0;
      var mockEnv = {
        fileInPath: function () { return false; },
        fileExists: function () { return false; },
        randomString: function () { return "abc123"; },
        exec: function (binary, args, opts, onStderr) {
          // First call is ffmpeg, succeeding
          return Promise.resolve();
        },
      };

      return sg.generateSubtitle("/path/video.mp4", "/model.bin", {}, mockEnv)
        .then(function (result) {
          expect(result.success).toBe(false);
          expect(result.code).toBe("ERR_WHISPER_NOT_FOUND");
        });
    });

    it("successfully generates subtitle with mock env", function () {
      var callCount = 0;
      var mockEnv = {
        fileInPath: function () { return true; },
        fileExists: function () { return true; },
        randomString: function () { return "abc123"; },
        exec: function (binary, args, opts, onStderr) {
          callCount++;
          // First call: ffmpeg
          if (callCount === 1) {
            return Promise.resolve();
          }
          // Second call: whisper
          if (callCount === 2) {
            return Promise.resolve();
          }
          // Third call: cp
          if (callCount === 3) {
            return Promise.resolve();
          }
          return Promise.resolve();
        },
      };

      return sg.generateSubtitle("/path/video.mp4", "/model.bin", {}, mockEnv)
        .then(function (result) {
          expect(result.success).toBe(true);
          expect(result.srtPath).toContain(".ai.srt");
          expect(callCount).toBe(4); // ffmpeg + whisper + cp + cleanup
        });
    });

    it("calls onStatus and onProgress callbacks", function () {
      var statusMessages = [];
      var progressLines = [];
      var callCount = 0;

      var mockEnv = {
        fileInPath: function () { return true; },
        fileExists: function () { return true; },
        randomString: function () { return "abc123"; },
        exec: function (binary, args, opts, onStderr) {
          callCount++;
          // First call: ffmpeg
          if (callCount === 1) {
            return Promise.resolve();
          }
          // Second call: whisper - call the stderr hook
          if (callCount === 2 && onStderr) {
            onStderr("main: processing progress:  50%|█████");
            onStderr("main: processing progress: 100%|██████");
          }
          // Third call: cp
          if (callCount === 3) {
            return Promise.resolve();
          }
          return Promise.resolve();
        },
      };

      return sg.generateSubtitle("/path/video.mp4", "/model.bin", {
        onStatus: function (s) { statusMessages.push(s); },
        onProgress: function (line) { progressLines.push(line); },
      }, mockEnv)
        .then(function (result) {
          expect(result.success).toBe(true);
          expect(progressLines.length).toBe(2);
          expect(progressLines[0]).toContain("50%");
          expect(callCount).toBe(4); // ffmpeg + whisper + cp + cleanup
        });
    });
  });

  describe("cleanup", function () {
    it("calls rm -rf for each temp path", function () {
      var cleaned = [];

      var mockEnv = {
        exec: function (binary, args) {
          cleaned.push({ binary: binary, args: args });
          return Promise.resolve();
        },
      };

      sg.cleanup(["/tmp/dir1", "/tmp/dir2"], mockEnv);

      expect(cleaned.length).toBe(2);
      expect(cleaned[0].binary).toBe("rm");
      expect(cleaned[0].args).toEqual(["-rf", "/tmp/dir1"]);
    });

    it("handles empty array gracefully", function () {
      var mockEnv = {
        exec: function () {
          throw new Error("should not be called");
        },
      };
      sg.cleanup([], mockEnv);
    });

    it("handles null input gracefully", function () {
      var mockEnv = {
        exec: function () {
          throw new Error("should not be called");
        },
      };
      sg.cleanup(null, mockEnv);
    });

    it("handles rm rejection gracefully", function () {
      var mockEnv = {
        exec: function () {
          return Promise.reject(new Error("rm failed"));
        },
      };
      sg.cleanup(["/tmp/test"], mockEnv);
    });
  });
});
