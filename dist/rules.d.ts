/**
 * Match a hostname against a pattern.
 *
 * Supported patterns:
 * - '*' matches any hostname
 * - '*.example.com' matches subdomains of example.com (but not example.com itself)
 * - 'example.com' exact match
 * - 'google.*' matches google.com, google.co.uk, etc.
 *
 * @param hostname - The hostname to match
 * @param pattern - The pattern to match against
 * @returns true if hostname matches pattern
 */
export declare function matchPattern(hostname: string, pattern: string): boolean;
/**
 * Determine if a hostname should be proxied based on rules.
 *
 * Rules semantics:
 * - [] (empty) → no proxy (return false)
 * - ['*'] → proxy everything
 * - ['example.com'] → proxy only example.com
 * - ['*.google.com'] → proxy subdomains of google.com
 * - ['*', '-example.com'] → proxy everything except example.com
 * - ['AUTO', 'example.com'] → AUTO is placeholder (ignored), proxy example.com
 *
 * Negative patterns (prefixed with '-') exclude hosts from proxying.
 * If '*' is in rules, default is to proxy unless excluded.
 * Without '*', only explicitly matched patterns are proxied.
 *
 * @param hostname - The hostname to check
 * @param rules - Array of rule patterns
 * @returns true if the hostname should be proxied
 */
export declare function shouldProxy(hostname: string, rules: string[]): boolean;
