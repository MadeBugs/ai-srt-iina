var pp = require("../lib/progress-parser.js");

describe("progress-parser", function () {
  describe("parseProgressLine", function () {
    it("parses whisper progress line with percentage", function () {
      var result = pp.parseProgressLine(
        "main: processing progress:  65%|██████▋   | 98/150 [00:19<00:10,  4.87it/s]"
      );
      expect(result.type).toBe("progress");
      expect(result.percent).toBe(65);
    });

    it("recognizes 100% as done", function () {
      var result = pp.parseProgressLine(
        "main: processing progress: 100%|██████████| 150/150 [00:30<00:00,  4.87it/s]"
      );
      expect(result.type).toBe("done");
      expect(result.percent).toBe(100);
    });

    it("handles alternative whisper_cpp prefix", function () {
      var result = pp.parseProgressLine(
        "whisper_cpp: processing progress:  50%|█████     | 75/150"
      );
      expect(result.type).toBe("progress");
      expect(result.percent).toBe(50);
    });

    it("detects ffmpeg progress lines", function () {
      var result = pp.parseProgressLine(
        "size=1024kB time=00:01:30.00 bitrate=256kbits/s speed=1.5x"
      );
      expect(result.type).toBe("ffmpeg");
    });

    it("detects done via standalone 100%", function () {
      var result = pp.parseProgressLine("some output 100% complete");
      expect(result.type).toBe("done");
      expect(result.percent).toBe(100);
    });

    it("returns other for unrecognized lines", function () {
      var result = pp.parseProgressLine("llama_model_loader: loaded vocabulary");
      expect(result.type).toBe("other");
      expect(result.percent).toBeNull();
    });

    it("handles empty string", function () {
      var result = pp.parseProgressLine("");
      expect(result.type).toBe("other");
      expect(result.percent).toBeNull();
    });

    it("handles null input", function () {
      var result = pp.parseProgressLine(null);
      expect(result.type).toBe("other");
      expect(result.percent).toBeNull();
    });

    it("detects done via altProgressMatch at 100%", function () {
      var result = pp.parseProgressLine("whisper_cpp: processing progress: 100%");
      expect(result.type).toBe("done");
      expect(result.percent).toBe(100);
    });

    it("reports progress for altProgressMatch under 100%", function () {
      var result = pp.parseProgressLine("whisper_cpp: processing progress:  42%");
      expect(result.type).toBe("progress");
      expect(result.percent).toBe(42);
    });
  });

  describe("getProgressPercentage", function () {
    it("returns 0 for null state", function () {
      expect(pp.getProgressPercentage(null)).toBe(0);
    });

    it("returns 0 for state without latestPercent", function () {
      expect(pp.getProgressPercentage({})).toBe(0);
    });

    it("returns the stored percentage", function () {
      expect(pp.getProgressPercentage({ latestPercent: 75 })).toBe(75);
    });
  });

  describe("createProgressTracker", function () {
    it("starts with idle status and 0 percent", function () {
      var tracker = pp.createProgressTracker();
      var status = tracker.getStatus();
      expect(status.status).toBe("idle");
      expect(status.percent).toBe(0);
      expect(status.message).toBe("Generating subtitle...");
    });

    it("transitions to extracting-audio on ffmpeg line", function () {
      var tracker = pp.createProgressTracker();
      tracker.handleStderrLine(
        "size=1024kB time=00:01:30.00 bitrate=256kbits/s"
      );
      var status = tracker.getStatus();
      expect(status.status).toBe("extracting-audio");
      expect(status.message).toBe("Extracting audio...");
    });

    it("transitions to transcribing on whisper progress line", function () {
      var tracker = pp.createProgressTracker();
      tracker.handleStderrLine(
        "main: processing progress:  50%|█████     | 75/150"
      );
      var status = tracker.getStatus();
      expect(status.status).toBe("transcribing");
      expect(status.percent).toBe(50);
      expect(status.message).toBe("Transcribing: 50%");
    });

    it("tracks progress through multiple lines", function () {
      var tracker = pp.createProgressTracker();
      tracker.handleStderrLine("main: processing progress:  10%|█        | 15/150");
      expect(tracker.getStatus().percent).toBe(10);

      tracker.handleStderrLine("main: processing progress:  50%|█████     | 75/150");
      expect(tracker.getStatus().percent).toBe(50);

      tracker.handleStderrLine("main: processing progress:  90%|█████████ | 135/150");
      expect(tracker.getStatus().percent).toBe(90);
    });

    it("transitions to done on 100%", function () {
      var tracker = pp.createProgressTracker();
      tracker.handleStderrLine("main: processing progress: 100%|██████████| 150/150");
      var status = tracker.getStatus();
      expect(status.status).toBe("done");
      expect(status.percent).toBe(100);
      expect(status.message).toBe("Done");
    });

    it("exposes latestPercent and status as properties", function () {
      var tracker = pp.createProgressTracker();
      expect(tracker.latestPercent).toBe(0);
      expect(tracker.status).toBe("idle");

      tracker.handleStderrLine("main: processing progress:  75%|███████   |");
      expect(tracker.latestPercent).toBe(75);
      expect(tracker.status).toBe("transcribing");
    });
  });
});
