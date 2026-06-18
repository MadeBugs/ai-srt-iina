var depChecker = require("../lib/dependency-checker.js");

describe("dependency-checker", function () {
  describe("checkWhisperBinary", function () {
    it("returns found=true when whisper-cli is in path", function () {
      var mockEnv = {
        fileInPath: function (name) {
          return name === "whisper-cli";
        },
        fileExists: function () { return false; },
      };
      var result = depChecker.checkWhisperBinary(mockEnv);
      expect(result.found).toBe(true);
      expect(result.binary).toBe("whisper-cli");
    });

    it("falls back to whisper-cpp when whisper-cli is not found", function () {
      var mockEnv = {
        fileInPath: function (name) {
          return name === "whisper-cpp";
        },
        fileExists: function () { return false; },
      };
      var result = depChecker.checkWhisperBinary(mockEnv);
      expect(result.found).toBe(true);
      expect(result.binary).toBe("whisper-cpp");
    });

    it("finds whisper via Homebrew path fallback", function () {
      var mockEnv = {
        fileInPath: function () { return false; },
        fileExists: function (path) {
          return path === "/opt/homebrew/bin/whisper-cli";
        },
      };
      var result = depChecker.checkWhisperBinary(mockEnv);
      expect(result.found).toBe(true);
      expect(result.path).toBe("/opt/homebrew/bin/whisper-cli");
    });

    it("returns found=false when neither binary is available", function () {
      var mockEnv = {
        fileInPath: function () { return false; },
        fileExists: function () { return false; },
      };
      var result = depChecker.checkWhisperBinary(mockEnv);
      expect(result.found).toBe(false);
      expect(result.binary).toBeNull();
    });
  });

  describe("checkFFmpeg", function () {
    it("returns found=true when ffmpeg is in path", function () {
      var mockEnv = {
        fileInPath: function () {
          return true;
        },
      };
      expect(depChecker.checkFFmpeg(mockEnv).found).toBe(true);
    });

    it("returns found=false when ffmpeg is not in path", function () {
      var mockEnv = {
        fileInPath: function () {
          return false;
        },
      };
      expect(depChecker.checkFFmpeg(mockEnv).found).toBe(false);
    });
  });

  describe("findModelFile", function () {
    it("finds model in home cache directory", function () {
      var mockEnv = {
        fileExists: function (path) {
          return path.indexOf("ggml-small.en-q8_0.bin") >= 0
            && path.indexOf(".cache/whisper-cpp") >= 0;
        },
        resolvePath: function () {
          return null;
        },
        homeDir: function () {
          return "/Users/test";
        },
      };
      var result = depChecker.findModelFile(mockEnv);
      expect(result.found).toBe(true);
      expect(result.path).toContain("ggml-small.en-q8_0.bin");
    });

    it("finds model in local models directory", function () {
      var mockEnv = {
        fileExists: function (path) {
          return path.indexOf("models/") >= 0;
        },
        resolvePath: function () {
          return null;
        },
        homeDir: function () {
          return "/Users/test";
        },
      };
      var result = depChecker.findModelFile(mockEnv);
      expect(result.found).toBe(true);
      expect(result.path).toContain("models/");
    });

    it("returns found=false when model is not found", function () {
      var mockEnv = {
        fileExists: function () {
          return false;
        },
        resolvePath: function () {
          return null;
        },
        homeDir: function () {
          return "/Users/test";
        },
      };
      var result = depChecker.findModelFile(mockEnv);
      expect(result.found).toBe(false);
      expect(result.path).toBeNull();
    });
  });

  describe("checkAll", function () {
    it("returns allReady=true when all dependencies are met", function () {
      var mockEnv = {
        fileInPath: function () {
          return true;
        },
        fileExists: function () {
          return true;
        },
        resolvePath: function () {
          return "/data/models/ggml-small.en-q8_0.bin";
        },
        homeDir: function () {
          return "/Users/test";
        },
      };
      var result = depChecker.checkAll(mockEnv);
      expect(result.allReady).toBe(true);
      expect(result.whisper.found).toBe(true);
      expect(result.ffmpeg.found).toBe(true);
      expect(result.model.found).toBe(true);
    });

    it("returns allReady=false when any dependency is missing", function () {
      var mockEnv = {
        fileInPath: function (name) {
          return name === "ffmpeg";
        },
        fileExists: function () {
          return false;
        },
        resolvePath: function () {
          return null;
        },
        homeDir: function () {
          return "/Users/test";
        },
      };
      var result = depChecker.checkAll(mockEnv);
      expect(result.allReady).toBe(false);
      expect(result.whisper.found).toBe(false);
      expect(result.ffmpeg.found).toBe(true);
      expect(result.model.found).toBe(false);
    });
  });

  it("exports DEFAULT_MODEL_URL constant", function () {
    expect(depChecker.DEFAULT_MODEL_URL).toBeDefined();
    expect(depChecker.DEFAULT_MODEL_URL).toContain("huggingface.co");
  });

  describe("expandHome edge cases", function () {
    it("handles paths without tilde", function () {
      var result = depChecker.checkAll({
        fileInPath: function () { return false; },
        fileExists: function () { return false; },
        resolvePath: function () { return null; },
        homeDir: function () { return "/home/user"; },
      });
      expect(result.allReady).toBe(false);
    });

    it("handles undefined homeDir gracefully", function () {
      var mockEnv = {
        fileInPath: function () { return false; },
        fileExists: function () { return false; },
        resolvePath: function () { return null; },
        homeDir: function () { return ""; },
      };
      var result = depChecker.findModelFile(mockEnv);
      expect(result.found).toBe(false);
    });

    it("returns {found: false} on exception in fileInPath", function () {
      var mockEnv = {
        fileInPath: function () { return false; },
        fileExists: function () { return false; },
        resolvePath: function () { return "/data/models/model.bin"; },
        homeDir: function () { return "/home/user"; },
      };
      var result = depChecker.checkAll(mockEnv);
      expect(result.allReady).toBe(false);
    });

    it("checks resolvePath when fileExists returns true for data dir", function () {
      var mockEnv = {
        fileExists: function (path) {
          return path.indexOf("iina-data") >= 0;
        },
        resolvePath: function (p) {
          return "/iina-data/" + p.replace("@data/", "");
        },
        homeDir: function () { return "/home/user"; },
      };
      var result = depChecker.findModelFile(mockEnv);
      expect(result.found).toBe(true);
      expect(result.path).toContain("iina-data");
    });
  });
});
