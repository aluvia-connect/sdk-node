// BlockDetection - Website block detection with weighted scoring

import type { Logger } from "./logger.js";

/**
 * Detection tier based on scoring
 */
export type DetectionTier = "blocked" | "suspected" | "clear";

/**
 * A single detection signal with weight
 */
export type DetectionSignal = {
  name: string;
  weight: number;
  details: string;
  source: "fast" | "full";
};

/**
 * A single hop in a redirect chain
 */
export type RedirectHop = {
  url: string;
  statusCode: number;
};

/**
 * Result of block detection analysis
 */
export type BlockDetectionResult = {
  url: string;
  hostname: string;
  tier: DetectionTier;
  score: number;
  signals: DetectionSignal[];
  pass: "fast" | "full";
  persistentBlock: boolean;
  redirectChain: RedirectHop[];
};

/**
 * Configuration for block detection
 */
export type BlockDetectionConfig = {
  enabled?: boolean;
  challengeSelectors?: string[];
  extraKeywords?: string[];
  extraStatusCodes?: number[];
  networkIdleTimeoutMs?: number;
  autoUnblock?: boolean;
  autoUnblockOnSuspected?: boolean;
  onDetection?: (
    result: BlockDetectionResult,
    page: any,
  ) => void | Promise<void>;
};

const DEFAULT_CHALLENGE_SELECTORS = [
  "#challenge-form",
  "#challenge-running",
  ".cf-browser-verification",
  'iframe[src*="recaptcha"]',
  ".g-recaptcha",
  "#px-captcha",
  'iframe[src*="hcaptcha"]',
  ".h-captcha",
];

const TITLE_KEYWORDS = [
  "access denied",
  "blocked",
  "forbidden",
  "security check",
  "attention required",
  "just a moment",
];

const STRONG_TEXT_KEYWORDS = [
  "captcha",
  "access denied",
  "verify you are human",
  "bot detection",
];

const WEAK_TEXT_KEYWORDS = [
  "blocked",
  "forbidden",
  "cloudflare",
  "please verify",
  "unusual activity",
];

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const WEAK_TEXT_REGEXES: Array<{ keyword: string; regex: RegExp }> =
  WEAK_TEXT_KEYWORDS.map((keyword) => ({
    keyword,
    regex: new RegExp("\\b" + escapeRegex(keyword) + "\\b", "i"),
  }));

const CHALLENGE_DOMAIN_PATTERNS = [
  "/cdn-cgi/challenge-platform/",
  "challenges.cloudflare.com",
  "geo.captcha-delivery.com",
];

/**
 * BlockDetection handles detection of website blocks, CAPTCHAs, and WAF challenges
 * using a weighted scoring system across multiple signal types.
 */
export class BlockDetection {
  private config: {
    enabled: boolean;
    challengeSelectors: string[];
    extraKeywords: string[];
    extraStatusCodes: number[];
    networkIdleTimeoutMs: number;
    autoUnblock: boolean;
    autoUnblockOnSuspected: boolean;
    onDetection?: (
      result: BlockDetectionResult,
      page: any,
    ) => void | Promise<void>;
  };
  private logger: Logger;

  // Persistent block tracking
  public retriedUrls = new Set<string>();
  public persistentHostnames = new Set<string>();

  constructor(config: BlockDetectionConfig, logger: Logger) {
    this.logger = logger;
    this.config = {
      enabled: config.enabled ?? true,
      challengeSelectors:
        config.challengeSelectors ?? DEFAULT_CHALLENGE_SELECTORS,
      extraKeywords: config.extraKeywords ?? [],
      extraStatusCodes: config.extraStatusCodes ?? [],
      networkIdleTimeoutMs: config.networkIdleTimeoutMs ?? 3000,
      autoUnblock: config.autoUnblock ?? false,
      autoUnblockOnSuspected: config.autoUnblockOnSuspected ?? false,
      onDetection: config.onDetection,
    };
  }

  getNetworkIdleTimeoutMs(): number {
    return this.config.networkIdleTimeoutMs;
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  getOnDetection():
    | ((
        result: BlockDetectionResult,
        page: any,
      ) => void | Promise<void>)
    | undefined {
    return this.config.onDetection;
  }

  isAutoUnblock(): boolean {
    return this.config.autoUnblock;
  }

  isAutoUnblockOnSuspected(): boolean {
    return this.config.autoUnblockOnSuspected;
  }

  // --- Scoring Engine ---

  private computeScore(
    signals: DetectionSignal[],
  ): { score: number; tier: DetectionTier } {
    if (signals.length === 0) return { score: 0, tier: "clear" };
    const score =
      1 - signals.reduce((product, s) => product * (1 - s.weight), 1);
    const tier =
      score >= 0.7 ? "blocked" : score >= 0.4 ? "suspected" : "clear";
    return { score, tier };
  }

  // --- Fast-pass Signal Detectors ---

  private detectHttpStatus(response: any): DetectionSignal | null {
    const status = response?.status?.() ?? 0;
    if (status === 0) return null;

    const allCodes = [403, 429, ...this.config.extraStatusCodes];
    if (allCodes.includes(status)) {
      return {
        name: `http_status_${status}`,
        weight: 0.85,
        details: `HTTP ${status} response`,
        source: "fast",
      };
    }

    if (status === 503) {
      return {
        name: "http_status_503",
        weight: 0.6,
        details: "HTTP 503 response",
        source: "fast",
      };
    }

    return null;
  }

  private detectResponseHeaders(response: any): DetectionSignal[] {
    const signals: DetectionSignal[] = [];
    if (!response) return signals;

    try {
      const headers = response.headers?.() ?? {};

      const cfMitigated = headers["cf-mitigated"];
      if (
        cfMitigated &&
        cfMitigated.toLowerCase().includes("challenge")
      ) {
        signals.push({
          name: "waf_header_cf_mitigated",
          weight: 0.9,
          details: `cf-mitigated: ${cfMitigated}`,
          source: "fast",
        });
      }

      const server = headers["server"];
      if (server && server.toLowerCase().includes("cloudflare")) {
        signals.push({
          name: "waf_header_cloudflare",
          weight: 0.1,
          details: `server: ${server}`,
          source: "fast",
        });
      }
    } catch {
      // Graceful degradation
    }

    return signals;
  }

  // --- Full-pass Signal Detectors ---

  private async detectTitleKeywords(
    page: any,
  ): Promise<DetectionSignal | null> {
    try {
      const title = (await page.title()).toLowerCase();
      const allKeywords = [...TITLE_KEYWORDS, ...this.config.extraKeywords];
      for (const keyword of allKeywords) {
        if (title.includes(keyword.toLowerCase())) {
          return {
            name: "title_keyword",
            weight: 0.8,
            details: `Title contains "${keyword}"`,
            source: "full",
          };
        }
      }
    } catch {
      // Graceful degradation
    }
    return null;
  }

  private async detectChallengeSelectors(
    page: any,
  ): Promise<DetectionSignal | null> {
    try {
      const selectors = this.config.challengeSelectors;
      const found = await page.evaluate((sels: string[]) => {
        for (const sel of sels) {
          if (document.querySelector(sel)) return sel;
        }
        return null;
      }, selectors);

      if (found) {
        return {
          name: "challenge_selector",
          weight: 0.8,
          details: `Challenge selector found: ${found}`,
          source: "full",
        };
      }
    } catch {
      // Graceful degradation
    }
    return null;
  }

  private async detectVisibleText(
    page: any,
    useInnerText = false,
  ): Promise<DetectionSignal[]> {
    const signals: DetectionSignal[] = [];
    try {
      const text: string = useInnerText
        ? await page.evaluate(() => document.body?.innerText ?? "")
        : await page.evaluate(() => document.body?.textContent ?? "");

      const textLower = text.toLowerCase();

      if (text.length < 50) {
        signals.push({
          name: "visible_text_short",
          weight: 0.2,
          details: `Visible text very short (${text.length} chars)`,
          source: "full",
        });
      }

      // Strong keywords (substring match, short page < 500 chars)
      if (text.length < 500) {
        const allStrong = [
          ...STRONG_TEXT_KEYWORDS,
          ...this.config.extraKeywords,
        ];
        for (const keyword of allStrong) {
          if (textLower.includes(keyword.toLowerCase())) {
            signals.push({
              name: "visible_text_keyword_strong",
              weight: 0.6,
              details: `Strong keyword "${keyword}" on short page`,
              source: "full",
            });
            break;
          }
        }
      }

      // Weak keywords (word-boundary match, pre-compiled regexes)
      for (const { keyword, regex } of WEAK_TEXT_REGEXES) {
        if (regex.test(text)) {
          signals.push({
            name: "visible_text_keyword_weak",
            weight: 0.15,
            details: `Weak keyword "${keyword}" found with word boundary`,
            source: "full",
          });
          break;
        }
      }
    } catch {
      // Graceful degradation
    }
    return signals;
  }

  private async detectTextToHtmlRatio(
    page: any,
  ): Promise<DetectionSignal | null> {
    try {
      const result = await page.evaluate(() => {
        const html = document.documentElement?.outerHTML ?? "";
        const text = document.body?.textContent ?? "";
        return { htmlLength: html.length, textLength: text.length };
      });

      if (
        result.htmlLength >= 1000 &&
        result.textLength / result.htmlLength < 0.03
      ) {
        return {
          name: "low_text_ratio",
          weight: 0.2,
          details: `Low text/HTML ratio: ${result.textLength}/${result.htmlLength}`,
          source: "full",
        };
      }
    } catch {
      // Graceful degradation
    }
    return null;
  }

  private detectRedirectChain(
    response: any,
  ): { signals: DetectionSignal[]; chain: RedirectHop[] } {
    const chain: RedirectHop[] = [];
    const signals: DetectionSignal[] = [];

    try {
      if (!response) return { signals, chain };

      // Walk redirect chain backwards
      let req = response.request?.();
      const hops: Array<{ url: string; statusCode: number }> = [];

      while (req) {
        const redirectedFrom = req.redirectedFrom?.();
        if (!redirectedFrom) break;
        const redirectResponse = redirectedFrom.response?.();
        hops.push({
          url: redirectedFrom.url?.() ?? "",
          statusCode: redirectResponse?.status?.() ?? 0,
        });
        req = redirectedFrom;
      }

      // Reverse to get chronological order
      hops.reverse();
      chain.push(...hops);

      // Check if any hop URL matches challenge domain patterns
      for (const hop of chain) {
        for (const pattern of CHALLENGE_DOMAIN_PATTERNS) {
          if (hop.url.includes(pattern)) {
            signals.push({
              name: "redirect_to_challenge",
              weight: 0.7,
              details: `Redirect through challenge domain: ${hop.url}`,
              source: "full",
            });
            return { signals, chain };
          }
        }
      }

      // Also check the final response URL
      const finalUrl = response.url?.() ?? "";
      for (const pattern of CHALLENGE_DOMAIN_PATTERNS) {
        if (finalUrl.includes(pattern)) {
          signals.push({
            name: "redirect_to_challenge",
            weight: 0.7,
            details: `Final URL is challenge domain: ${finalUrl}`,
            source: "full",
          });
          break;
        }
      }
    } catch {
      // Graceful degradation
    }

    return { signals, chain };
  }

  private async detectMetaRefresh(
    page: any,
  ): Promise<DetectionSignal | null> {
    try {
      const refreshUrl = await page.evaluate(() => {
        const meta = document.querySelector('meta[http-equiv="refresh"]');
        if (!meta) return null;
        const content = meta.getAttribute("content") ?? "";
        const match = content.match(/url\s*=\s*(.+)/i);
        return match ? match[1].trim() : null;
      });

      if (refreshUrl) {
        for (const pattern of CHALLENGE_DOMAIN_PATTERNS) {
          if (refreshUrl.includes(pattern)) {
            return {
              name: "meta_refresh_challenge",
              weight: 0.65,
              details: `Meta refresh to challenge URL: ${refreshUrl}`,
              source: "full",
            };
          }
        }
      }
    } catch {
      // Graceful degradation
    }
    return null;
  }

  // --- Two-Pass Analysis API ---

  /**
   * Fast pass - runs at domcontentloaded. Only HTTP status + response headers.
   * If score >= 0.9, caller should trigger remediation immediately.
   */
  async analyzeFast(
    page: any,
    response: any,
  ): Promise<BlockDetectionResult> {
    const url = page.url();
    const hostname = this.extractHostname(url);

    if (!this.config.enabled) {
      return this.makeResult(url, hostname, [], "fast", []);
    }

    const signals: DetectionSignal[] = [];

    const statusSignal = this.detectHttpStatus(response);
    if (statusSignal) signals.push(statusSignal);

    const headerSignals = this.detectResponseHeaders(response);
    signals.push(...headerSignals);

    const result = this.makeResult(url, hostname, signals, "fast", []);
    this.logResult(result);
    return result;
  }

  /**
   * Full pass - runs after networkidle. Runs all detectors and merges with fast pass.
   */
  async analyzeFull(
    page: any,
    response: any,
    fastResult?: BlockDetectionResult,
  ): Promise<BlockDetectionResult> {
    const url = page.url();
    const hostname = this.extractHostname(url);

    if (!this.config.enabled) {
      return this.makeResult(url, hostname, [], "full", []);
    }

    // Start with fast-pass signals
    const signals: DetectionSignal[] = fastResult
      ? [...fastResult.signals]
      : [];

    // If no fast pass was done and we have a response, run fast detectors
    if (!fastResult && response) {
      const statusSignal = this.detectHttpStatus(response);
      if (statusSignal) signals.push(statusSignal);

      const headerSignals = this.detectResponseHeaders(response);
      signals.push(...headerSignals);
    }

    // Full-pass detectors (parallelized — all are independent page reads)
    const [titleSignal, challengeSignal, textSignals, ratioSignal, metaSignal] =
      await Promise.all([
        this.detectTitleKeywords(page),
        this.detectChallengeSelectors(page),
        this.detectVisibleText(page, false),
        this.detectTextToHtmlRatio(page),
        this.detectMetaRefresh(page),
      ]);

    if (titleSignal) signals.push(titleSignal);
    if (challengeSignal) signals.push(challengeSignal);
    signals.push(...textSignals);
    if (ratioSignal) signals.push(ratioSignal);

    const { signals: redirectSignals, chain } =
      this.detectRedirectChain(response);
    signals.push(...redirectSignals);

    if (metaSignal) signals.push(metaSignal);

    return this.reEvaluateIfSuspected(page, url, hostname, signals, chain);
  }

  /**
   * SPA navigation analysis - content-based detectors only, no HTTP signals.
   */
  async analyzeSpa(page: any): Promise<BlockDetectionResult> {
    const url = page.url();
    const hostname = this.extractHostname(url);

    if (!this.config.enabled) {
      return this.makeResult(url, hostname, [], "full", []);
    }

    // Content-based detectors (parallelized — all are independent page reads)
    const [titleSignal, challengeSignal, textSignals, ratioSignal, metaSignal] =
      await Promise.all([
        this.detectTitleKeywords(page),
        this.detectChallengeSelectors(page),
        this.detectVisibleText(page, false),
        this.detectTextToHtmlRatio(page),
        this.detectMetaRefresh(page),
      ]);

    const signals: DetectionSignal[] = [];
    if (titleSignal) signals.push(titleSignal);
    if (challengeSignal) signals.push(challengeSignal);
    signals.push(...textSignals);
    if (ratioSignal) signals.push(ratioSignal);
    if (metaSignal) signals.push(metaSignal);

    return this.reEvaluateIfSuspected(page, url, hostname, signals, []);
  }

  private async reEvaluateIfSuspected(
    page: any,
    url: string,
    hostname: string,
    signals: DetectionSignal[],
    redirectChain: RedirectHop[],
  ): Promise<BlockDetectionResult> {
    const preliminary = this.computeScore(signals);
    if (preliminary.score >= 0.4 && preliminary.score < 0.7) {
      const nonTextSignals = signals.filter(
        (s) => !s.name.startsWith("visible_text_"),
      );
      const innerTextSignals = await this.detectVisibleText(page, true);
      nonTextSignals.push(...innerTextSignals);

      const result = this.makeResult(url, hostname, nonTextSignals, "full", redirectChain);
      this.logResult(result);
      return result;
    }

    const result = this.makeResult(url, hostname, signals, "full", redirectChain);
    this.logResult(result);
    return result;
  }

  // --- Utility Methods ---

  private makeResult(
    url: string,
    hostname: string,
    signals: DetectionSignal[],
    pass: "fast" | "full",
    redirectChain: RedirectHop[],
  ): BlockDetectionResult {
    const { score, tier } = this.computeScore(signals);
    return {
      url,
      hostname,
      tier,
      score,
      signals,
      pass,
      persistentBlock: false,
      redirectChain,
    };
  }

  private logResult(result: BlockDetectionResult): void {
    this.logger.debug(
      `Detection result: ${JSON.stringify({
        url: result.url,
        tier: result.tier,
        score: result.score,
        signals: result.signals.map((s) => ({
          name: s.name,
          weight: s.weight,
          source: s.source,
        })),
        pass: result.pass,
      })}`,
    );
  }

  private extractHostname(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch {
      return url;
    }
  }

}
