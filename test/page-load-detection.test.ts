// Tests for PageLoadDetection

import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { PageLoadDetection } from "../src/client/PageLoadDetection.js";
import { Logger } from "../src/client/logger.js";
import type { BlockingReason } from "../src/client/PageLoadDetection.js";

describe("PageLoadDetection", () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger("silent");
  });

  test("can be instantiated with default config", () => {
    const detection = new PageLoadDetection({}, logger);
    assert.ok(detection);
  });

  test("applies default configuration", () => {
    const detection = new PageLoadDetection({}, logger);
    assert.ok(detection);
    // Defaults should be enabled=true, autoAddRules=false
  });

  test("can be instantiated with custom config", () => {
    const detection = new PageLoadDetection(
      {
        enabled: false,
        blockingKeywords: ["custom"],
        blockingStatusCodes: [401],
        minContentLength: 200,
        autoAddRules: true,
      },
      logger,
    );
    assert.ok(detection);
  });

  test("updateConfig updates configuration", () => {
    const detection = new PageLoadDetection({ enabled: true }, logger);
    detection.updateConfig({ enabled: false });
    detection.updateConfig({ blockingKeywords: ["test"] });
    detection.updateConfig({ blockingStatusCodes: [500] });
    detection.updateConfig({ minContentLength: 300 });
    detection.updateConfig({ autoAddRules: true });
  });

  test("getBlockedHostnames returns empty array initially", () => {
    const detection = new PageLoadDetection({}, logger);
    const blocked = detection.getBlockedHostnames();
    assert.deepStrictEqual(blocked, []);
  });

  test("clearBlockedHostnames clears the list", () => {
    const detection = new PageLoadDetection({}, logger);
    detection.clearBlockedHostnames();
    assert.deepStrictEqual(detection.getBlockedHostnames(), []);
  });

  describe("analyzePage", () => {
    test("returns success when detection is disabled", async () => {
      const detection = new PageLoadDetection({ enabled: false }, logger);
      const mockPage = {
        url: () => "https://example.com/test",
        content: async () => "<html><body>Hello World</body></html>",
        title: async () => "Example",
      };
      const mockResponse = {
        status: () => 200,
      };

      const result = await detection.analyzePage(mockPage, mockResponse);

      assert.strictEqual(result.url, "https://example.com/test");
      assert.strictEqual(result.hostname, "example.com");
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.blocked, false);
      assert.strictEqual(result.reason, undefined);
    });

    test("detects blocking by HTTP status code 403", async () => {
      const detection = new PageLoadDetection({}, logger);
      const mockPage = {
        url: () => "https://example.com/test",
        content: async () => "<html><body>Forbidden</body></html>",
        title: async () => "Forbidden",
      };
      const mockResponse = {
        status: () => 403,
      };

      const result = await detection.analyzePage(mockPage, mockResponse);

      assert.strictEqual(result.url, "https://example.com/test");
      assert.strictEqual(result.hostname, "example.com");
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.blocked, true);
      assert.ok(result.reason);
      assert.strictEqual(result.reason.type, "status_code");
      assert.strictEqual(result.reason.statusCode, 403);
      assert.ok(result.reason.details.includes("403"));
    });

    test("detects blocking by HTTP status code 429", async () => {
      const detection = new PageLoadDetection({}, logger);
      const mockPage = {
        url: () => "https://example.com/test",
        content: async () => "<html><body>Too Many Requests</body></html>",
        title: async () => "Rate Limited",
      };
      const mockResponse = {
        status: () => 429,
      };

      const result = await detection.analyzePage(mockPage, mockResponse);

      assert.strictEqual(result.blocked, true);
      assert.strictEqual(result.reason?.type, "status_code");
      assert.strictEqual(result.reason?.statusCode, 429);
    });

    test("detects blocking by HTTP status code 503", async () => {
      const detection = new PageLoadDetection({}, logger);
      const mockPage = {
        url: () => "https://example.com/test",
        content: async () => "<html><body>Service Unavailable</body></html>",
        title: async () => "Unavailable",
      };
      const mockResponse = {
        status: () => 503,
      };

      const result = await detection.analyzePage(mockPage, mockResponse);

      assert.strictEqual(result.blocked, true);
      assert.strictEqual(result.reason?.type, "status_code");
      assert.strictEqual(result.reason?.statusCode, 503);
    });

    test("detects short content length", async () => {
      const detection = new PageLoadDetection(
        { minContentLength: 100 },
        logger,
      );
      const mockPage = {
        url: () => "https://example.com/test",
        content: async () => "<html></html>", // Very short content
        title: async () => "Test",
      };
      const mockResponse = {
        status: () => 200,
      };

      const result = await detection.analyzePage(mockPage, mockResponse);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.blocked, false);
      assert.ok(result.reason);
      assert.strictEqual(result.reason.type, "content_length");
      assert.ok(result.reason.details.includes("too short"));
    });

    test("detects 'captcha' keyword in content", async () => {
      const detection = new PageLoadDetection({}, logger);
      const mockPage = {
        url: () => "https://example.com/test",
        content: async () =>
          "<html><body>Please solve this CAPTCHA to continue</body></html>",
        title: async () => "Security Check",
      };
      const mockResponse = {
        status: () => 200,
      };

      const result = await detection.analyzePage(mockPage, mockResponse);

      assert.strictEqual(result.blocked, true);
      assert.strictEqual(result.reason?.type, "keyword");
      assert.strictEqual(result.reason?.keyword, "captcha");
      assert.ok(result.reason?.details.includes("captcha"));
    });

    test("detects 'blocked' keyword in content", async () => {
      const detection = new PageLoadDetection({}, logger);
      const mockPage = {
        url: () => "https://example.com/test",
        content: async () =>
          "<html><body>You have been blocked from accessing this site</body></html>",
        title: async () => "Access Blocked",
      };
      const mockResponse = {
        status: () => 200,
      };

      const result = await detection.analyzePage(mockPage, mockResponse);

      assert.strictEqual(result.blocked, true);
      assert.strictEqual(result.reason?.type, "keyword");
      assert.strictEqual(result.reason?.keyword, "blocked");
    });

    test("detects 'cloudflare' keyword in content", async () => {
      const detection = new PageLoadDetection({}, logger);
      const mockPage = {
        url: () => "https://example.com/test",
        content: async () =>
          "<html><body>Cloudflare protection enabled</body></html>",
        title: async () => "Cloudflare",
      };
      const mockResponse = {
        status: () => 200,
      };

      const result = await detection.analyzePage(mockPage, mockResponse);

      assert.strictEqual(result.blocked, true);
      assert.strictEqual(result.reason?.type, "keyword");
      assert.strictEqual(result.reason?.keyword, "cloudflare");
    });

    test("detects keyword in page title", async () => {
      const detection = new PageLoadDetection({}, logger);
      const mockPage = {
        url: () => "https://example.com/test",
        content: async () => "<html><body>Content here</body></html>",
        title: async () => "Access Denied - Security Check",
      };
      const mockResponse = {
        status: () => 200,
      };

      const result = await detection.analyzePage(mockPage, mockResponse);

      assert.strictEqual(result.blocked, true);
      assert.strictEqual(result.reason?.type, "keyword");
      assert.strictEqual(result.reason?.keyword, "access denied");
    });

    test("is case-insensitive for keyword detection", async () => {
      const detection = new PageLoadDetection({}, logger);
      const mockPage = {
        url: () => "https://example.com/test",
        content: async () => "<html><body>CAPTCHA required</body></html>",
        title: async () => "Test",
      };
      const mockResponse = {
        status: () => 200,
      };

      const result = await detection.analyzePage(mockPage, mockResponse);

      assert.strictEqual(result.blocked, true);
      assert.strictEqual(result.reason?.keyword, "captcha");
    });

    test("uses custom keywords when provided", async () => {
      const detection = new PageLoadDetection(
        {
          blockingKeywords: ["custom-block", "special-check"],
        },
        logger,
      );
      const mockPage = {
        url: () => "https://example.com/test",
        content: async () => "<html><body>custom-block detected</body></html>",
        title: async () => "Test",
      };
      const mockResponse = {
        status: () => 200,
      };

      const result = await detection.analyzePage(mockPage, mockResponse);

      assert.strictEqual(result.blocked, true);
      assert.strictEqual(result.reason?.keyword, "custom-block");
    });

    test("uses custom status codes when provided", async () => {
      const detection = new PageLoadDetection(
        {
          blockingStatusCodes: [401, 402],
        },
        logger,
      );
      const mockPage = {
        url: () => "https://example.com/test",
        content: async () => "<html><body>Unauthorized</body></html>",
        title: async () => "Test",
      };
      const mockResponse = {
        status: () => 401,
      };

      const result = await detection.analyzePage(mockPage, mockResponse);

      assert.strictEqual(result.blocked, true);
      assert.strictEqual(result.reason?.statusCode, 401);
    });

    test("returns success for normal page load", async () => {
      const detection = new PageLoadDetection({}, logger);
      const mockPage = {
        url: () => "https://example.com/test",
        content: async () =>
          "<html><body><h1>Welcome</h1><p>This is a normal page with enough content to pass the check.</p></body></html>",
        title: async () => "Welcome",
      };
      const mockResponse = {
        status: () => 200,
      };

      const result = await detection.analyzePage(mockPage, mockResponse);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.blocked, false);
      assert.strictEqual(result.reason, undefined);
    });

    test("adds hostname to blocked list when blocking detected", async () => {
      const detection = new PageLoadDetection({}, logger);
      const mockPage = {
        url: () => "https://example.com/test",
        content: async () => "<html><body>CAPTCHA</body></html>",
        title: async () => "Test",
      };
      const mockResponse = {
        status: () => 200,
      };

      assert.deepStrictEqual(detection.getBlockedHostnames(), []);

      await detection.analyzePage(mockPage, mockResponse);

      const blocked = detection.getBlockedHostnames();
      assert.strictEqual(blocked.length, 1);
      assert.strictEqual(blocked[0], "example.com");
    });

    test("calls onBlockingDetected callback when provided", async () => {
      let callbackHostname: string | null = null;
      let callbackReason: BlockingReason | null = null;

      const detection = new PageLoadDetection(
        {
          onBlockingDetected: (hostname: string, reason: BlockingReason) => {
            callbackHostname = hostname;
            callbackReason = reason;
          },
        },
        logger,
      );

      const mockPage = {
        url: () => "https://example.com/test",
        content: async () => "<html><body>captcha</body></html>",
        title: async () => "Test",
      };
      const mockResponse = {
        status: () => 200,
      };

      await detection.analyzePage(mockPage, mockResponse);

      assert.strictEqual(callbackHostname, "example.com");
      assert.ok(callbackReason);
      assert.strictEqual(callbackReason!.type, "keyword");
      assert.strictEqual(callbackReason!.keyword, "captcha");
    });

    test("handles page.content() errors gracefully", async () => {
      const detection = new PageLoadDetection({}, logger);
      const mockPage = {
        url: () => "https://example.com/test",
        content: async () => {
          throw new Error("Failed to get content");
        },
        title: async () => "Test",
      };
      const mockResponse = {
        status: () => 200,
      };

      const result = await detection.analyzePage(mockPage, mockResponse);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.blocked, false);
      assert.strictEqual(result.reason?.type, "error");
    });

    test("handles page.title() errors gracefully", async () => {
      const detection = new PageLoadDetection({}, logger);
      const mockPage = {
        url: () => "https://example.com/test",
        content: async () =>
          "<html><body>Normal content here that is long enough</body></html>",
        title: async () => {
          throw new Error("Failed to get title");
        },
      };
      const mockResponse = {
        status: () => 200,
      };

      const result = await detection.analyzePage(mockPage, mockResponse);

      // Should still check content even if title fails
      // Result should be success since content is fine
      assert.strictEqual(result.success, true);
    });

    test("handles missing response gracefully", async () => {
      const detection = new PageLoadDetection({}, logger);
      const mockPage = {
        url: () => "https://example.com/test",
        content: async () =>
          "<html><body>Normal content here that is long enough</body></html>",
        title: async () => "Test",
      };

      const result = await detection.analyzePage(mockPage, null);

      // Should not throw, should check content
      assert.ok(result);
      assert.strictEqual(result.hostname, "example.com");
    });

    test("prioritizes status code detection over keyword detection", async () => {
      const detection = new PageLoadDetection({}, logger);
      const mockPage = {
        url: () => "https://example.com/test",
        content: async () => "<html><body>captcha detected</body></html>",
        title: async () => "Test",
      };
      const mockResponse = {
        status: () => 403,
      };

      const result = await detection.analyzePage(mockPage, mockResponse);

      // Status code should be detected first
      assert.strictEqual(result.blocked, true);
      assert.strictEqual(result.reason?.type, "status_code");
      assert.strictEqual(result.reason?.statusCode, 403);
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
        const mockPage = {
          url: () => tc.url,
          content: async () => "<html><body>test</body></html>",
          title: async () => "Test",
        };
        const mockResponse = { status: () => 200 };

        const result = await detection.analyzePage(mockPage, mockResponse);
        assert.strictEqual(
          result.hostname,
          tc.expected,
          `Failed for URL: ${tc.url}`,
        );
      }
    });

    test("detects multiple blocking keywords", async () => {
      const detection = new PageLoadDetection({}, logger);

      const keywords = [
        "captcha",
        "blocked",
        "access denied",
        "forbidden",
        "cloudflare",
        "recaptcha",
        "hcaptcha",
        "bot detection",
        "verify you are human",
      ];

      for (const keyword of keywords) {
        const mockPage = {
          url: () => "https://example.com/test",
          content: async () =>
            `<html><body>Please note: ${keyword} is required</body></html>`,
          title: async () => "Test",
        };
        const mockResponse = { status: () => 200 };

        const result = await detection.analyzePage(mockPage, mockResponse);
        assert.strictEqual(
          result.blocked,
          true,
          `Failed to detect keyword: ${keyword}`,
        );
        assert.strictEqual(result.reason?.keyword, keyword);
      }
    });
  });

  describe("isHostnameBlocked", () => {
    test("returns false for hostname that is not blocked", () => {
      const detection = new PageLoadDetection({}, logger);
      assert.strictEqual(detection.isHostnameBlocked("example.com"), false);
    });

    test("returns true for hostname that is blocked", async () => {
      const detection = new PageLoadDetection({}, logger);
      const mockPage = {
        url: () => "https://example.com/test",
        content: async () => "<html><body>captcha</body></html>",
        title: async () => "Test",
      };
      const mockResponse = { status: () => 200 };

      await detection.analyzePage(mockPage, mockResponse);

      assert.strictEqual(detection.isHostnameBlocked("example.com"), true);
      assert.strictEqual(detection.isHostnameBlocked("other.com"), false);
    });
  });
});
