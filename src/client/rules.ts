// Rule engine for hostname matching and proxy decision

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
export function matchPattern(hostname: string, pattern: string): boolean {
  // Normalize inputs to lowercase
  const normalizedHostname = hostname.trim().toLowerCase();
  const normalizedPattern = pattern.trim().toLowerCase();

  if (!normalizedHostname) return false;
  if (!normalizedPattern) return false;

  // Universal wildcard matches everything
  if (normalizedPattern === '*') {
    return true;
  }

  // Exact match
  if (normalizedHostname === normalizedPattern) {
    return true;
  }

  // Prefix wildcard: *.example.com matches subdomains
  if (normalizedPattern.startsWith('*.')) {
    const suffix = normalizedPattern.slice(1); // '.example.com'
    // Must end with the suffix and have something before it
    if (normalizedHostname.endsWith(suffix)) {
      const prefix = normalizedHostname.slice(0, -suffix.length);
      // Prefix must not be empty. This matches any subdomain depth (for example, foo.example.com and foo.bar.example.com).
      return prefix.length > 0;
    }
    return false;
  }

  // Suffix wildcard: google.* matches google.com, google.co.uk, etc.
  if (normalizedPattern.endsWith('.*')) {
    const prefix = normalizedPattern.slice(0, -2); // 'google'
    // Must start with prefix followed by a dot
    if (normalizedHostname.startsWith(prefix + '.')) {
      return true;
    }
    return false;
  }

  return false;
}

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
export function shouldProxy(hostname: string, rules: string[]): boolean {
  const normalizedHostname = hostname.trim();
  if (!normalizedHostname) return false;

  // Empty rules means no proxy
  if (!rules || rules.length === 0) {
    return false;
  }

  const normalizedRules = rules
    .filter((r) => typeof r === 'string')
    .map((r) => r.trim())
    .filter((r) => r.length > 0);

  // Filter out AUTO placeholder
  const effectiveRules = normalizedRules.filter((r) => r.toUpperCase() !== 'AUTO');

  // If no effective rules after filtering, no proxy
  if (effectiveRules.length === 0) {
    return false;
  }

  // Separate positive and negative rules
  const negativeRules: string[] = [];
  const positiveRules: string[] = [];

  for (const rule of effectiveRules) {
    if (rule.startsWith('-')) {
      const neg = rule.slice(1).trim(); // Remove the '-' prefix
      if (neg.length > 0) negativeRules.push(neg);
    } else {
      positiveRules.push(rule);
    }
  }

  // Check if hostname matches any negative rule
  for (const negRule of negativeRules) {
    if (matchPattern(normalizedHostname, negRule)) {
      // Excluded by negative rule
      return false;
    }
  }

  // Check if we have a catch-all '*'
  const hasCatchAll = positiveRules.includes('*');

  if (hasCatchAll) {
    // With catch-all, proxy everything not excluded by negative rules
    return true;
  }

  // Without catch-all, check if hostname matches any positive rule
  for (const posRule of positiveRules) {
    if (matchPattern(normalizedHostname, posRule)) {
      return true;
    }
  }

  // No match found
  return false;
}


