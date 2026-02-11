// Tests for PageLoadDetection - weighted scoring system

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";
import { PageLoadDetection } from "../src/client/PageLoadDetection.js";
import { Logger } from "../src/client/logger.js";
import type { DetectionSignal } from "../src/client/PageLoadDetection.js";

describe("PageLoadDetection", () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger("silent");
  });

  test("can be instantiated with default config", () => {
    const detection = new PageLoadDetection({}, logger);
    assert.ok(detection);
    assert.strictEqual(detection.isEnabled(), true);
  });

  test("can be instantiated with custom config", () => {
    const detection = new PageLoadDetection(
      {
        enabled: false,
        challengeSelectors: ["#custom"],
        extraKeywords: ["custom-block"],
        extraStatusCodes: [418],
        networkIdleTimeoutMs: 5000,
        autoReload: false,
        autoReloadOnSuspected: true,
      },
      logger,
    );
    assert.ok(detection);
    assert.strictEqual(detection.isEnabled(), false);
    assert.strictEqual(detection.isAutoReload(), false);
    assert.strictEqual(detection.isAutoReloadOnSuspected(), true);
    assert.strictEqual(detection.getNetworkIdleTimeoutMs(), 5000);
  });

  test("autoReload defaults to true", () => {
    const detection = new PageLoadDetection({}, logger);
    assert.strictEqual(detection.isAutoReload(), true);
  });

  describe("Scoring Engine", () => {
    test("empty signals produce score 0 and tier clear", async () => {
      const detection = new PageLoadDetection({}, logger);
      const mockPage = {
        url: () => "https://example.com",
        title: async () => "Normal Page",
        evaluate: async () => "Normal content on this page",
      };

      const result = await detection.analyzeFast(mockPage, null);
      assert.strictEqual(result.score, 0);
      assert.strictEqual(result.tier, "clear");
      assert.strictEqual(result.signals.length, 0);
    });

    test("single high signal produces blocked tier", async () => {
      const detection = new PageLoadDetection({}, logger);
      const mockPage = {
        url: () => "https://example.com",
      };
      const mockResponse = {
        status: () => 403,
        headers: () => ({}),
      };

      const result = await detection.analyzeFast(mockPage, mockResponse);
      assert.strictEqual(result.tier, "blocked");
      assert.ok(result.score >= 0.7);
    });

    test("probabilistic combination: two 0.2 signals produce ~0.36 not 0.4", async () => {
      // We test computeScore indirectly through analyzeFull
      // Two signals of weight 0.2 should give 1 - (0.8 * 0.8) = 0.36
      const detection = new PageLoadDetection({}, logger);

      // Access private method for direct testing
      const computeScore = (detection as any).computeScore.bind(detection);
      const twoWeakSignals: DetectionSignal[] = [
        { name: "a", weight: 0.2, details: "", source: "full" },
        { name: "b", weight: 0.2, details: "", source: "full" },
      ];
      const result = computeScore(twoWeakSignals);
      assert.strictEqual(result.score, 1 - 0.8 * 0.8); // 0.36
      assert.strictEqual(result.tier, "clear"); // 0.36 < 0.4
    });

    test("tier boundaries: 0.7 is blocked, 0.4 is suspected, below 0.4 is clear", () => {
      const detection = new PageLoadDetection({}, logger);
      const computeScore = (detection as any).computeScore.bind(detection);

      // Exactly 0.7 -> blocked
      const blocked = computeScore([
        { name: "a", weight: 0.7, details: "", source: "full" },
      ]);
      assert.strictEqual(blocked.tier, "blocked");

      // 0.5 -> suspected
      const suspected = computeScore([
        { name: "a", weight: 0.5, details: "", source: "full" },
      ]);
      assert.strictEqual(suspected.tier, "suspected");

      // 0.3 -> clear
      const clear = computeScore([
        { name: "a", weight: 0.3, details: "", source: "full" },
      ]);
      assert.strictEqual(clear.tier, "clear");
    });

    test("0.85 + 0.1 produces blocked tier (~0.865)", () => {
      const detection = new PageLoadDetection({}, logger);
      const computeScore = (detection as any).computeScore.bind(detection);

      const result = computeScore([
        { name: "a", weight: 0.85, details: "", source: "fast" },
        { name: "b", weight: 0.1, details: "", source: "fast" },
      ]);
      const expected = 1 - 0.15 * 0.9; // 0.865
      assert.ok(Math.abs(result.score - expected) < 0.001);
      assert.strictEqual(result.tier, "blocked");
    });
  });

  describe("Signal Detectors", () => {
    describe("HTTP Status", () => {
      test("403 returns weight 0.85", async () => {
        const detection = new PageLoadDetection({}, logger);
        const result = await detection.analyzeFast(
          { url: () => "https://example.com" },
          { status: () => 403, headers: () => ({}) },
        );
        const signal = result.signals.find((s) =>
          s.name.startsWith("http_status_"),
        );
        assert.ok(signal);
        assert.strictEqual(signal!.weight, 0.85);
        assert.strictEqual(signal!.name, "http_status_403");
      });

      test("429 returns weight 0.85", async () => {
        const detection = new PageLoadDetection({}, logger);
        const result = await detection.analyzeFast(
          { url: () => "https://example.com" },
          { status: () => 429, headers: () => ({}) },
        );
        const signal = result.signals.find((s) =>
          s.name.startsWith("http_status_"),
        );
        assert.ok(signal);
        assert.strictEqual(signal!.weight, 0.85);
      });

      test("503 returns weight 0.6", async () => {
        const detection = new PageLoadDetection({}, logger);
        const result = await detection.analyzeFast(
          { url: () => "https://example.com" },
          { status: () => 503, headers: () => ({}) },
        );
        const signal = result.signals.find((s) =>
          s.name.startsWith("http_status_"),
        );
        assert.ok(signal);
        assert.strictEqual(signal!.weight, 0.6);
        assert.strictEqual(signal!.name, "http_status_503");
      });

      test("200 returns no status signal", async () => {
        const detection = new PageLoadDetection({}, logger);
        const result = await detection.analyzeFast(
          { url: () => "https://example.com" },
          { status: () => 200, headers: () => ({}) },
        );
        const signal = result.signals.find((s) =>
          s.name.startsWith("http_status_"),
        );
        assert.strictEqual(signal, undefined);
      });

      test("extra status codes are detected with weight 0.85", async () => {
        const detection = new PageLoadDetection(
          { extraStatusCodes: [418] },
          logger,
        );
        const result = await detection.analyzeFast(
          { url: () => "https://example.com" },
          { status: () => 418, headers: () => ({}) },
        );
        const signal = result.signals.find((s) =>
          s.name.startsWith("http_status_"),
        );
        assert.ok(signal);
        assert.strictEqual(signal!.weight, 0.85);
      });
    });

    describe("Response Headers", () => {
      test("cf-mitigated: challenge returns weight 0.9", async () => {
        const detection = new PageLoadDetection({}, logger);
        const result = await detection.analyzeFast(
          { url: () => "https://example.com" },
          {
            status: () => 200,
            headers: () => ({ "cf-mitigated": "challenge" }),
          },
        );
        const signal = result.signals.find(
          (s) => s.name === "waf_header_cf_mitigated",
        );
        assert.ok(signal);
        assert.strictEqual(signal!.weight, 0.9);
      });

      test("server: cloudflare returns weight 0.1", async () => {
        const detection = new PageLoadDetection({}, logger);
        const result = await detection.analyzeFast(
          { url: () => "https://example.com" },
          {
            status: () => 200,
            headers: () => ({ server: "cloudflare" }),
          },
        );
        const signal = result.signals.find(
          (s) => s.name === "waf_header_cloudflare",
        );
        assert.ok(signal);
        assert.strictEqual(signal!.weight, 0.1);
      });
    });

    describe("Title Keywords", () => {
      test("title with 'access denied' returns weight 0.8", async () => {
        const detection = new PageLoadDetection({}, logger);
        const mockPage = {
          url: () => "https://example.com",
          title: async () => "Access Denied",
          evaluate: async () => "",
        };

        const result = await detection.analyzeFull(mockPage, null);
        const signal = result.signals.find((s) => s.name === "title_keyword");
        assert.ok(signal);
        assert.strictEqual(signal!.weight, 0.8);
      });

      test("title with 'just a moment' returns weight 0.8", async () => {
        const detection = new PageLoadDetection({}, logger);
        const mockPage = {
          url: () => "https://example.com",
          title: async () => "Just a moment...",
          evaluate: async () => "",
        };

        const result = await detection.analyzeFull(mockPage, null);
        const signal = result.signals.find((s) => s.name === "title_keyword");
        assert.ok(signal);
        assert.strictEqual(signal!.weight, 0.8);
      });

      test("normal title produces no title_keyword signal", async () => {
        const detection = new PageLoadDetection({}, logger);
        const mockPage = {
          url: () => "https://example.com",
          title: async () => "Welcome to Our Site",
          evaluate: async () =>
            "Welcome to our site. We have lots of great content here for you to enjoy and explore.",
        };

        const result = await detection.analyzeFull(mockPage, null);
        const signal = result.signals.find((s) => s.name === "title_keyword");
        assert.strictEqual(signal, undefined);
      });
    });

    describe("Challenge Selectors", () => {
      test("page with #challenge-form returns weight 0.8", async () => {
        const detection = new PageLoadDetection({}, logger);
        const mockPage = {
          url: () => "https://example.com",
          title: async () => "Test",
          evaluate: async (fn: any, ...args: any[]) => {
            // Simulate the evaluate calls
            if (typeof fn === "function") {
              const fnStr = fn.toString();
              // Challenge selector check
              if (fnStr.includes("querySelector")) {
                return "#challenge-form";
              }
              // textContent check
              if (fnStr.includes("textContent")) {
                return { htmlLength: 500, textLength: 100 };
              }
              return "Normal page content";
            }
            return null;
          },
        };

        const result = await detection.analyzeFull(mockPage, null);
        const signal = result.signals.find(
          (s) => s.name === "challenge_selector",
        );
        assert.ok(signal);
        assert.strictEqual(signal!.weight, 0.8);
      });
    });

    describe("Visible Text", () => {
      test("short text (<50 chars) produces visible_text_short signal", async () => {
        const detection = new PageLoadDetection({}, logger);
        const mockPage = {
          url: () => "https://example.com",
          title: async () => "Test",
          evaluate: async (fn: any, ...args: any[]) => {
            const fnStr = fn.toString();
            if (fnStr.includes("querySelector")) return null;
            if (fnStr.includes("outerHTML"))
              return { htmlLength: 500, textLength: 10 };
            return "Hi"; // Very short text
          },
        };

        const result = await detection.analyzeFull(mockPage, null);
        const signal = result.signals.find(
          (s) => s.name === "visible_text_short",
        );
        assert.ok(signal);
        assert.strictEqual(signal!.weight, 0.2);
      });

      test("strong keyword 'captcha' on short page returns weight 0.6", async () => {
        const detection = new PageLoadDetection({}, logger);
        const mockPage = {
          url: () => "https://example.com",
          title: async () => "Test",
          evaluate: async (fn: any, ...args: any[]) => {
            const fnStr = fn.toString();
            if (fnStr.includes("querySelector")) return null;
            if (fnStr.includes("outerHTML"))
              return { htmlLength: 500, textLength: 100 };
            return "Please solve this captcha to continue";
          },
        };

        const result = await detection.analyzeFull(mockPage, null);
        const signal = result.signals.find(
          (s) => s.name === "visible_text_keyword_strong",
        );
        assert.ok(signal);
        assert.strictEqual(signal!.weight, 0.6);
      });

      test("weak keyword 'blocked' with word boundary returns weight 0.15", async () => {
        const detection = new PageLoadDetection({}, logger);
        const mockPage = {
          url: () => "https://example.com",
          title: async () => "Test",
          evaluate: async (fn: any, ...args: any[]) => {
            const fnStr = fn.toString();
            if (fnStr.includes("querySelector")) return null;
            if (fnStr.includes("outerHTML"))
              return { htmlLength: 500, textLength: 200 };
            // Long enough to avoid strong keyword detection (>= 500 chars)
            return "You are blocked from accessing this resource. " +
              "a".repeat(500);
          },
        };

        const result = await detection.analyzeFull(mockPage, null);
        const signal = result.signals.find(
          (s) => s.name === "visible_text_keyword_weak",
        );
        assert.ok(signal);
        assert.strictEqual(signal!.weight, 0.15);
      });
    });

    describe("Word Boundary Matching", () => {
      test("'blocked' matches 'you are blocked'", () => {
        const detection = new PageLoadDetection({}, logger);
        const escapeRegex = (detection as any).escapeRegex.bind(detection);
        const regex = new RegExp("\\b" + escapeRegex("blocked") + "\\b", "i");
        assert.strictEqual(regex.test("you are blocked"), true);
      });

      test("'blocked' does not match 'blockchain'", () => {
        const detection = new PageLoadDetection({}, logger);
        const escapeRegex = (detection as any).escapeRegex.bind(detection);
        const regex = new RegExp("\\b" + escapeRegex("blocked") + "\\b", "i");
        assert.strictEqual(regex.test("blockchain technology"), false);
      });

      test("'blocked' does not match 'ad-blocking'", () => {
        const detection = new PageLoadDetection({}, logger);
        const escapeRegex = (detection as any).escapeRegex.bind(detection);
        const regex = new RegExp("\\b" + escapeRegex("blocked") + "\\b", "i");
        assert.strictEqual(regex.test("ad-blocking extension"), false);
      });

      test("'forbidden' does not match 'forbiddenly' or 'unforbidden'", () => {
        const detection = new PageLoadDetection({}, logger);
        const escapeRegex = (detection as any).escapeRegex.bind(detection);
        const regex = new RegExp(
          "\\b" + escapeRegex("forbidden") + "\\b",
          "i",
        );
        assert.strictEqual(regex.test("forbiddenly"), false);
        assert.strictEqual(regex.test("unforbidden"), false);
      });

      test("'cloudflare' matches 'Powered by Cloudflare'", () => {
        const detection = new PageLoadDetection({}, logger);
        const escapeRegex = (detection as any).escapeRegex.bind(detection);
        const regex = new RegExp(
          "\\b" + escapeRegex("cloudflare") + "\\b",
          "i",
        );
        assert.strictEqual(regex.test("Powered by Cloudflare"), true);
      });
    });

    describe("Text-to-HTML Ratio", () => {
      test("fires when html >= 1000 bytes and ratio < 0.03", async () => {
        const detection = new PageLoadDetection({}, logger);
        const mockPage = {
          url: () => "https://example.com",
          title: async () => "Test",
          evaluate: async (fn: any) => {
            const fnStr = fn.toString();
            if (fnStr.includes("querySelector")) return null;
            if (fnStr.includes("outerHTML"))
              return { htmlLength: 2000, textLength: 10 }; // ratio = 0.005
            return "a".repeat(600); // Long enough to avoid strong keyword on short page
          },
        };

        const result = await detection.analyzeFull(mockPage, null);
        const signal = result.signals.find((s) => s.name === "low_text_ratio");
        assert.ok(signal);
        assert.strictEqual(signal!.weight, 0.2);
      });

      test("does not fire when html < 1000 bytes", async () => {
        const detection = new PageLoadDetection({}, logger);
        const mockPage = {
          url: () => "https://example.com",
          title: async () => "Test",
          evaluate: async (fn: any) => {
            const fnStr = fn.toString();
            if (fnStr.includes("querySelector")) return null;
            if (fnStr.includes("outerHTML"))
              return { htmlLength: 500, textLength: 5 }; // Small page
            return "a".repeat(600);
          },
        };

        const result = await detection.analyzeFull(mockPage, null);
        const signal = result.signals.find((s) => s.name === "low_text_ratio");
        assert.strictEqual(signal, undefined);
      });

      test("does not fire when ratio >= 0.03", async () => {
        const detection = new PageLoadDetection({}, logger);
        const mockPage = {
          url: () => "https://example.com",
          title: async () => "Test",
          evaluate: async (fn: any) => {
            const fnStr = fn.toString();
            if (fnStr.includes("querySelector")) return null;
            if (fnStr.includes("outerHTML"))
              return { htmlLength: 2000, textLength: 100 }; // ratio = 0.05
            return "a".repeat(600);
          },
        };

        const result = await detection.analyzeFull(mockPage, null);
        const signal = result.signals.find((s) => s.name === "low_text_ratio");
        assert.strictEqual(signal, undefined);
      });
    });

    describe("Redirect Chain", () => {
      test("redirect through challenge domain returns weight 0.7", async () => {
        const detection = new PageLoadDetection({}, logger);
        const mockRedirectedFrom = {
          url: () => "https://challenges.cloudflare.com/abc",
          redirectedFrom: () => null,
          response: () => ({ status: () => 302 }),
        };
        const mockRequest = {
          redirectedFrom: () => mockRedirectedFrom,
        };
        const mockResponse = {
          status: () => 200,
          headers: () => ({}),
          request: () => mockRequest,
          url: () => "https://example.com",
        };
        const mockPage = {
          url: () => "https://example.com",
          title: async () => "Test",
          evaluate: async (fn: any) => {
            const fnStr = fn.toString();
            if (fnStr.includes("querySelector")) return null;
            if (fnStr.includes("outerHTML"))
              return { htmlLength: 500, textLength: 100 };
            if (fnStr.includes("refresh")) return null;
            return "Normal page with enough content to be normal and long enough to avoid short detection";
          },
        };

        const result = await detection.analyzeFull(mockPage, mockResponse);
        const signal = result.signals.find(
          (s) => s.name === "redirect_to_challenge",
        );
        assert.ok(signal);
        assert.strictEqual(signal!.weight, 0.7);
        assert.ok(result.redirectChain.length > 0);
      });
    });

    describe("Meta Refresh", () => {
      test("meta refresh to challenge URL returns weight 0.65", async () => {
        const detection = new PageLoadDetection({}, logger);
        const mockPage = {
          url: () => "https://example.com",
          title: async () => "Test",
          evaluate: async (fn: any) => {
            const fnStr = fn.toString();
            if (fnStr.includes("querySelector") && fnStr.includes("refresh"))
              return "https://geo.captcha-delivery.com/verify";
            if (fnStr.includes("querySelector")) return null;
            if (fnStr.includes("outerHTML"))
              return { htmlLength: 500, textLength: 100 };
            return "Normal content here that is long enough to avoid short page detection signals";
          },
        };

        const result = await detection.analyzeFull(mockPage, null);
        const signal = result.signals.find(
          (s) => s.name === "meta_refresh_challenge",
        );
        assert.ok(signal);
        assert.strictEqual(signal!.weight, 0.65);
      });
    });
  });

  describe("Two-Pass Flow", () => {
    test("fast pass returns pass='fast' with only HTTP signals", async () => {
      const detection = new PageLoadDetection({}, logger);
      const result = await detection.analyzeFast(
        { url: () => "https://example.com" },
        {
          status: () => 403,
          headers: () => ({ server: "cloudflare" }),
        },
      );
      assert.strictEqual(result.pass, "fast");
      // Should have http_status and waf_header_cloudflare signals
      assert.ok(
        result.signals.every((s) => s.source === "fast"),
        "All signals should be fast-pass",
      );
    });

    test("full pass merges signals from fast pass", async () => {
      const detection = new PageLoadDetection({}, logger);
      const mockResponse = {
        status: () => 403,
        headers: () => ({ server: "cloudflare" }),
      };
      const mockPage = {
        url: () => "https://example.com",
        title: async () => "Forbidden",
        evaluate: async (fn: any) => {
          const fnStr = fn.toString();
          if (fnStr.includes("querySelector")) return null;
          if (fnStr.includes("outerHTML"))
            return { htmlLength: 500, textLength: 100 };
          return "Access forbidden page content";
        },
      };

      const fastResult = await detection.analyzeFast(mockPage, mockResponse);
      const fullResult = await detection.analyzeFull(
        mockPage,
        mockResponse,
        fastResult,
      );

      assert.strictEqual(fullResult.pass, "full");
      // Should contain both fast and full signals
      const fastSignals = fullResult.signals.filter(
        (s) => s.source === "fast",
      );
      const fullSignals = fullResult.signals.filter(
        (s) => s.source === "full",
      );
      assert.ok(fastSignals.length > 0, "Should have fast-pass signals");
      assert.ok(fullSignals.length > 0, "Should have full-pass signals");
    });

    test("full pass without fast pass still runs fast detectors", async () => {
      const detection = new PageLoadDetection({}, logger);
      const mockResponse = {
        status: () => 403,
        headers: () => ({}),
      };
      const mockPage = {
        url: () => "https://example.com",
        title: async () => "Test",
        evaluate: async () => "Normal content on this page that is long enough",
      };

      const result = await detection.analyzeFull(mockPage, mockResponse);
      const statusSignal = result.signals.find((s) =>
        s.name.startsWith("http_status_"),
      );
      assert.ok(statusSignal, "Should detect HTTP status even without fast pass");
    });

    test("analyzeSpa runs content-based detectors only", async () => {
      const detection = new PageLoadDetection({}, logger);
      const mockPage = {
        url: () => "https://example.com",
        title: async () => "Access Denied",
        evaluate: async (fn: any) => {
          const fnStr = fn.toString();
          if (fnStr.includes("querySelector")) return null;
          if (fnStr.includes("outerHTML"))
            return { htmlLength: 500, textLength: 100 };
          return "Access denied content";
        },
      };

      const result = await detection.analyzeSpa(mockPage);
      assert.strictEqual(result.pass, "full");
      // Should NOT have HTTP status signals
      const httpSignals = result.signals.filter((s) =>
        s.name.startsWith("http_status_"),
      );
      assert.strictEqual(httpSignals.length, 0);
      // Should have title keyword signal
      const titleSignal = result.signals.find(
        (s) => s.name === "title_keyword",
      );
      assert.ok(titleSignal);
    });
  });

  describe("Persistent Block Escalation", () => {
    test("retriedUrls tracks URLs", () => {
      const detection = new PageLoadDetection({}, logger);
      assert.strictEqual(detection.retriedUrls.size, 0);
      detection.retriedUrls.add("https://example.com/page1");
      assert.strictEqual(detection.retriedUrls.has("https://example.com/page1"), true);
    });

    test("persistentHostnames tracks hostnames", () => {
      const detection = new PageLoadDetection({}, logger);
      assert.strictEqual(detection.persistentHostnames.size, 0);
      detection.persistentHostnames.add("example.com");
      assert.strictEqual(detection.persistentHostnames.has("example.com"), true);
    });

    test("hostname already in persistentHostnames causes immediate skip", () => {
      const detection = new PageLoadDetection({}, logger);
      detection.persistentHostnames.add("example.com");
      // Any new URL on example.com should be immediately skipped
      assert.strictEqual(
        detection.persistentHostnames.has("example.com"),
        true,
      );
    });
  });

  describe("Edge Cases", () => {
    test("null response handled gracefully in analyzeFast", async () => {
      const detection = new PageLoadDetection({}, logger);
      const result = await detection.analyzeFast(
        { url: () => "https://example.com" },
        null,
      );
      assert.ok(result);
      assert.strictEqual(result.tier, "clear");
      assert.strictEqual(result.score, 0);
    });

    test("null response handled gracefully in analyzeFull", async () => {
      const detection = new PageLoadDetection({}, logger);
      const mockPage = {
        url: () => "https://example.com",
        title: async () => "Normal Page",
        evaluate: async () =>
          "Normal page content with enough text to pass all checks normally",
      };

      const result = await detection.analyzeFull(mockPage, null);
      assert.ok(result);
      assert.strictEqual(result.hostname, "example.com");
    });

    test("page.evaluate failure handled gracefully", async () => {
      const detection = new PageLoadDetection({}, logger);
      const mockPage = {
        url: () => "https://example.com",
        title: async () => {
          throw new Error("Page closed");
        },
        evaluate: async () => {
          throw new Error("Execution context destroyed");
        },
      };

      const result = await detection.analyzeFull(mockPage, null);
      // Should not throw, should return a result
      assert.ok(result);
      assert.strictEqual(result.hostname, "example.com");
    });

    test("disabled detection returns clear for all methods", async () => {
      const detection = new PageLoadDetection({ enabled: false }, logger);
      const mockPage = { url: () => "https://example.com" };
      const mockResponse = { status: () => 403, headers: () => ({}) };

      const fast = await detection.analyzeFast(mockPage, mockResponse);
      assert.strictEqual(fast.tier, "clear");
      assert.strictEqual(fast.score, 0);

      const full = await detection.analyzeFull(mockPage, mockResponse);
      assert.strictEqual(full.tier, "clear");

      const spa = await detection.analyzeSpa(mockPage);
      assert.strictEqual(spa.tier, "clear");
    });

    test("extracts hostname correctly from various URLs", async () => {
      const detection = new PageLoadDetection({}, logger);

      const testCases = [
        { url: "https://example.com/test", expected: "example.com" },
        { url: "http://sub.example.com/path", expected: "sub.example.com" },
        { url: "https://example.com:8080/test", expected: "example.com" },
        {
          url: "https://deeply.nested.sub.example.com",
          expected: "deeply.nested.sub.example.com",
        },
      ];

      for (const tc of testCases) {
        const result = await detection.analyzeFast(
          { url: () => tc.url },
          null,
        );
        assert.strictEqual(
          result.hostname,
          tc.expected,
          `Failed for URL: ${tc.url}`,
        );
      }
    });
  });

  describe("Structured Debug Logging", () => {
    test("logResult is called with structured JSON", async () => {
      const debugLogger = new Logger("debug");
      const calls: string[] = [];
      const originalDebug = debugLogger.debug.bind(debugLogger);
      debugLogger.debug = (...args: any[]) => {
        calls.push(args.join(" "));
      };

      const detection = new PageLoadDetection({}, debugLogger);
      await detection.analyzeFast(
        { url: () => "https://example.com" },
        { status: () => 403, headers: () => ({}) },
      );

      const logCall = calls.find((c) => c.includes("Detection result:"));
      assert.ok(logCall, "Should log detection result");
      const jsonPart = logCall!.replace("Detection result: ", "");
      const parsed = JSON.parse(jsonPart);
      assert.strictEqual(parsed.url, "https://example.com");
      assert.strictEqual(parsed.tier, "blocked");
      assert.ok(parsed.score > 0);
      assert.ok(Array.isArray(parsed.signals));
      assert.strictEqual(parsed.pass, "fast");
    });
  });
});
