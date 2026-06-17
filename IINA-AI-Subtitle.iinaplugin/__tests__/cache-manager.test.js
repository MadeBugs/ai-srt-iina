var cacheMgr = require("../lib/cache-manager.js");

describe("cache-manager", function () {
  describe("SUPPORTED_EXTENSIONS", function () {
    it("contains common video formats", function () {
      expect(cacheMgr.SUPPORTED_EXTENSIONS).toContain("mp4");
      expect(cacheMgr.SUPPORTED_EXTENSIONS).toContain("mkv");
      expect(cacheMgr.SUPPORTED_EXTENSIONS).toContain("mov");
      expect(cacheMgr.SUPPORTED_EXTENSIONS).toContain("avi");
      expect(cacheMgr.SUPPORTED_EXTENSIONS).toContain("webm");
      expect(cacheMgr.SUPPORTED_EXTENSIONS).toContain("m4v");
    });
  });

  describe("getVideoInfo", function () {
    it("parses a file:// URL correctly", function () {
      var info = cacheMgr.getVideoInfo("file:///Users/test/video.mp4");
      expect(info.fullPath).toBe("/Users/test/video.mp4");
      expect(info.dir).toBe("/Users/test");
      expect(info.filename).toBe("video.mp4");
      expect(info.basename).toBe("video");
      expect(info.ext).toBe("mp4");
    });

    it("parses a raw absolute path", function () {
      var info = cacheMgr.getVideoInfo("/absolute/path/file.mkv");
      expect(info.fullPath).toBe("/absolute/path/file.mkv");
      expect(info.dir).toBe("/absolute/path");
      expect(info.basename).toBe("file");
      expect(info.ext).toBe("mkv");
    });

    it("handles filenames with multiple dots", function () {
      var info = cacheMgr.getVideoInfo("/path/my.video.file.mkv");
      expect(info.basename).toBe("my.video.file");
      expect(info.ext).toBe("mkv");
    });

    it("handles uppercase extensions", function () {
      var info = cacheMgr.getVideoInfo("/path/video.MP4");
      expect(info.ext).toBe("mp4");
    });

    it("handles file without extension", function () {
      var info = cacheMgr.getVideoInfo("/path/noext");
      expect(info.basename).toBe("noext");
      expect(info.ext).toBe("");
    });

    it("handles empty input", function () {
      var info = cacheMgr.getVideoInfo("");
      expect(info.fullPath).toBe("");
    });
  });

  describe("getCachePath", function () {
    it("returns {basename}.ai.srt in same directory", function () {
      var result = cacheMgr.getCachePath("/Users/xxx/movie.mkv");
      expect(result).toBe("/Users/xxx/movie.ai.srt");
    });

    it("handles double .ai suffix gracefully", function () {
      var result = cacheMgr.getCachePath("/Users/xxx/movie.ai.srt");
      expect(result).toBe("/Users/xxx/movie.ai.ai.srt");
    });

    it("handles file in root directory", function () {
      var result = cacheMgr.getCachePath("/movie.mp4");
      expect(result).toBe("/movie.ai.srt");
    });
  });

  describe("cacheExists", function () {
    it("returns true when fileExists callback returns true", function () {
      expect(cacheMgr.cacheExists("/path/cache.srt", function () {
        return true;
      })).toBe(true);
    });

    it("returns false when fileExists callback returns false", function () {
      expect(cacheMgr.cacheExists("/path/cache.srt", function () {
        return false;
      })).toBe(false);
    });

    it("returns false for null path", function () {
      expect(cacheMgr.cacheExists(null)).toBe(false);
    });

    it("returns false when no fileExists callback provided", function () {
      expect(cacheMgr.cacheExists("/path/cache.srt")).toBe(false);
    });
  });

  describe("isValidVideoExtension", function () {
    it("returns true for supported extensions", function () {
      expect(cacheMgr.isValidVideoExtension("mp4")).toBe(true);
      expect(cacheMgr.isValidVideoExtension("mkv")).toBe(true);
      expect(cacheMgr.isValidVideoExtension("mov")).toBe(true);
      expect(cacheMgr.isValidVideoExtension("avi")).toBe(true);
      expect(cacheMgr.isValidVideoExtension("webm")).toBe(true);
      expect(cacheMgr.isValidVideoExtension("m4v")).toBe(true);
    });

    it("handles extension with leading dot", function () {
      expect(cacheMgr.isValidVideoExtension(".mp4")).toBe(true);
      expect(cacheMgr.isValidVideoExtension(".mkv")).toBe(true);
    });

    it("is case insensitive", function () {
      expect(cacheMgr.isValidVideoExtension("MP4")).toBe(true);
      expect(cacheMgr.isValidVideoExtension("MKV")).toBe(true);
    });

    it("returns false for unsupported extensions", function () {
      expect(cacheMgr.isValidVideoExtension("txt")).toBe(false);
      expect(cacheMgr.isValidVideoExtension("pdf")).toBe(false);
      expect(cacheMgr.isValidVideoExtension(".txt")).toBe(false);
    });

    it("returns false for null or undefined", function () {
      expect(cacheMgr.isValidVideoExtension(null)).toBe(false);
      expect(cacheMgr.isValidVideoExtension(undefined)).toBe(false);
    });
  });
});
