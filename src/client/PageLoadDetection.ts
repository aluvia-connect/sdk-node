// PageLoadDetection - Enhanced page load and blocking detection

import type { Logger } from "./logger.js";

/**
 * Configuration for page load detection
 */
export type PageLoadDetectionConfig = {
  /**
   * Enable automatic detection of blocking/captchas
   * Default: true
   */
  enabled?: boolean;

  /**
   * Keywords to search for in page content that indicate blocking
   * Default: ['captcha', 'blocked', 'access denied', 'forbidden', 'cloudflare', 'please verify', 'recaptcha']
   */
  blockingKeywords?: string[];

  /**
   * HTTP status codes that indicate blocking
   * Default: [403, 429, 503]
   */
  blockingStatusCodes?: number[];

  /**
   * Minimum content length for a successful page load
   * Pages with less content may have failed to load
   * Default: 100
   */
  minContentLength?: number;

  /**
   * Automatically add hostname to rules when blocking is detected
   * Default: false (user must opt-in)
   */
  autoAddRules?: boolean;

  /**
   * Callback when blocking is detected
   * Receives the hostname, detection reason, and the page object
   */
  onBlockingDetected?: (
    hostname: string,
    reason: BlockingReason,
    page: any,
  ) => void | Promise<void>;
};

/**
 * Reason why blocking was detected
 */
export type BlockingReason = {
  type: "status_code" | "keyword" | "content_length" | "error";
  details: string;
  statusCode?: number;
  keyword?: string;
};

/**
 * Result of page load detection
 */
export type PageLoadDetectionResult = {
  url: string;
  hostname: string;
  success: boolean;
  blocked: boolean;
  reason?: BlockingReason;
};

const DEFAULT_BLOCKING_KEYWORDS = [
  "captcha",
  "blocked",
  "access denied",
  "forbidden",
  "cloudflare",
  "please verify",
  "recaptcha",
  "hcaptcha",
  "bot detection",
  "automated access",
  "unusual activity",
  "verify you are human",
  "security check",
  "access restricted",
];

const DEFAULT_BLOCKING_STATUS_CODES = [403, 429, 503];

const DEFAULT_MIN_CONTENT_LENGTH = 100;

/**
 * PageLoadDetection handles enhanced detection of page load failures and blocking
 */
export class PageLoadDetection {
  private config: Required<
    Omit<PageLoadDetectionConfig, "onBlockingDetected">
  > & {
    onBlockingDetected?: (
      hostname: string,
      reason: BlockingReason,
      page: any,
    ) => void | Promise<void>;
  };
  private logger: Logger;
  private blockedHostnames = new Set<string>();

  constructor(config: PageLoadDetectionConfig, logger: Logger) {
    this.logger = logger;
    this.config = {
      enabled: config.enabled ?? true,
      blockingKeywords: config.blockingKeywords ?? DEFAULT_BLOCKING_KEYWORDS,
      blockingStatusCodes:
        config.blockingStatusCodes ?? DEFAULT_BLOCKING_STATUS_CODES,
      minContentLength: config.minContentLength ?? DEFAULT_MIN_CONTENT_LENGTH,
      autoAddRules: config.autoAddRules ?? false,
      onBlockingDetected: config.onBlockingDetected,
    };
  }

  /**
   * Update detection configuration
   */
  updateConfig(config: Partial<PageLoadDetectionConfig>): void {
    if (config.enabled !== undefined) {
      this.config.enabled = config.enabled;
    }
    if (config.blockingKeywords !== undefined) {
      this.config.blockingKeywords = config.blockingKeywords;
    }
    if (config.blockingStatusCodes !== undefined) {
      this.config.blockingStatusCodes = config.blockingStatusCodes;
    }
    if (config.minContentLength !== undefined) {
      this.config.minContentLength = config.minContentLength;
    }
    if (config.autoAddRules !== undefined) {
      this.config.autoAddRules = config.autoAddRules;
    }
    if (config.onBlockingDetected !== undefined) {
      this.config.onBlockingDetected = config.onBlockingDetected;
    }
  }

  /**
   * Check if a hostname is already marked as blocked
   */
  isHostnameBlocked(hostname: string): boolean {
    return this.blockedHostnames.has(hostname);
  }

  /**
   * Get all blocked hostnames
   */
  getBlockedHostnames(): string[] {
    return Array.from(this.blockedHostnames);
  }

  /**
   * Clear blocked hostnames cache
   */
  clearBlockedHostnames(): void {
    this.blockedHostnames.clear();
  }

  /**
   * Analyze a page load and detect if it was blocked
   */
  async analyzePage(
    page: any,
    response: any,
  ): Promise<PageLoadDetectionResult> {
    if (!this.config.enabled) {
      return {
        url: page.url(),
        hostname: this.extractHostname(page.url()),
        success: true,
        blocked: false,
      };
    }

    this.logger.debug("Analyzing page load for URL: " + page.url());

    const url = page.url();
    const hostname = this.extractHostname(url);

    try {
      // Check HTTP status code
      const statusCode = response?.status?.() ?? 0;
      if (
        statusCode > 0 &&
        this.config.blockingStatusCodes.includes(statusCode)
      ) {
        const reason: BlockingReason = {
          type: "status_code",
          details: `HTTP status code ${statusCode} indicates blocking`,
          statusCode,
        };
        await this.handleBlocking(hostname, reason, page);
        return { url, hostname, success: false, blocked: true, reason };
      }

      // Get page content
      const content = await page.content().catch(() => "");

      // Check for blocking keywords first (more specific than content length)
      const contentLower = content.toLowerCase();
      const title = (await page.title().catch(() => "")).toLowerCase();
      const combinedText = `${contentLower} ${title}`;

      for (const keyword of this.config.blockingKeywords) {
        if (combinedText.includes(keyword.toLowerCase())) {
          const reason: BlockingReason = {
            type: "keyword",
            details: `Blocking keyword detected: "${keyword}"`,
            keyword,
          };
          await this.handleBlocking(hostname, reason, page);
          return { url, hostname, success: false, blocked: true, reason };
        }
      }

      // Check content length (less critical than keywords)
      if (!content || content.length < this.config.minContentLength) {
        const reason: BlockingReason = {
          type: "content_length",
          details: `Page content too short (${content.length} < ${this.config.minContentLength})`,
        };
        this.logger.warn(
          `Page may have failed to load: ${url} (${reason.details})`,
        );
        return { url, hostname, success: false, blocked: false, reason };
      }

      // Page loaded successfully
      return { url, hostname, success: true, blocked: false };
    } catch (error: any) {
      const reason: BlockingReason = {
        type: "error",
        details: `Error analyzing page: ${error.message}`,
      };
      this.logger.warn(
        `Error checking page load status for ${url}: ${error.message}`,
      );
      return { url, hostname, success: false, blocked: false, reason };
    }
  }

  /**
   * Handle detected blocking
   */
  private async handleBlocking(
    hostname: string,
    reason: BlockingReason,
    page: any,
  ): Promise<void> {
    this.blockedHostnames.add(hostname);
    this.logger.warn(`Blocking detected for ${hostname}: ${reason.details}`);

    // Trigger callback if provided
    if (this.config.onBlockingDetected) {
      try {
        await this.config.onBlockingDetected(hostname, reason, page);
      } catch (error: any) {
        this.logger.warn(
          `Error in onBlockingDetected callback: ${error.message}`,
        );
      }
    }
  }

  /**
   * Extract hostname from URL
   */
  private extractHostname(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch {
      return url;
    }
  }
}
