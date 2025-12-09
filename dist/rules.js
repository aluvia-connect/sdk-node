"use strict";
// Rule engine for hostname matching and proxy decision
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchPattern = matchPattern;
exports.shouldProxy = shouldProxy;
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
function matchPattern(hostname, pattern) {
    // Normalize inputs to lowercase
    const normalizedHostname = hostname.toLowerCase();
    const normalizedPattern = pattern.toLowerCase();
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
            // Prefix must not be empty and must not contain dots (single level subdomain match)
            // Actually, *.example.com should match foo.bar.example.com too
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
function shouldProxy(hostname, rules) {
    // Empty rules means no proxy
    if (!rules || rules.length === 0) {
        return false;
    }
    // Filter out AUTO placeholder
    const effectiveRules = rules.filter((r) => r.toUpperCase() !== 'AUTO');
    // If no effective rules after filtering, no proxy
    if (effectiveRules.length === 0) {
        return false;
    }
    // Separate positive and negative rules
    const negativeRules = [];
    const positiveRules = [];
    for (const rule of effectiveRules) {
        if (rule.startsWith('-')) {
            negativeRules.push(rule.slice(1)); // Remove the '-' prefix
        }
        else {
            positiveRules.push(rule);
        }
    }
    // Check if hostname matches any negative rule
    for (const negRule of negativeRules) {
        if (matchPattern(hostname, negRule)) {
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
        if (matchPattern(hostname, posRule)) {
            return true;
        }
    }
    // No match found
    return false;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicnVsZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvcnVsZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLHVEQUF1RDs7QUFldkQsb0NBdUNDO0FBcUJELGtDQW1EQztBQTVIRDs7Ozs7Ozs7Ozs7O0dBWUc7QUFDSCxTQUFnQixZQUFZLENBQUMsUUFBZ0IsRUFBRSxPQUFlO0lBQzVELGdDQUFnQztJQUNoQyxNQUFNLGtCQUFrQixHQUFHLFFBQVEsQ0FBQyxXQUFXLEVBQUUsQ0FBQztJQUNsRCxNQUFNLGlCQUFpQixHQUFHLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBQztJQUVoRCx3Q0FBd0M7SUFDeEMsSUFBSSxpQkFBaUIsS0FBSyxHQUFHLEVBQUUsQ0FBQztRQUM5QixPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRCxjQUFjO0lBQ2QsSUFBSSxrQkFBa0IsS0FBSyxpQkFBaUIsRUFBRSxDQUFDO1FBQzdDLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVELG9EQUFvRDtJQUNwRCxJQUFJLGlCQUFpQixDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1FBQ3ZDLE1BQU0sTUFBTSxHQUFHLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLGlCQUFpQjtRQUM1RCx3REFBd0Q7UUFDeEQsSUFBSSxrQkFBa0IsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQztZQUN4QyxNQUFNLE1BQU0sR0FBRyxrQkFBa0IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQzNELG9GQUFvRjtZQUNwRiwrREFBK0Q7WUFDL0QsT0FBTyxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztRQUMzQixDQUFDO1FBQ0QsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0lBRUQsbUVBQW1FO0lBQ25FLElBQUksaUJBQWlCLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7UUFDckMsTUFBTSxNQUFNLEdBQUcsaUJBQWlCLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVztRQUMxRCwyQ0FBMkM7UUFDM0MsSUFBSSxrQkFBa0IsQ0FBQyxVQUFVLENBQUMsTUFBTSxHQUFHLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDaEQsT0FBTyxJQUFJLENBQUM7UUFDZCxDQUFDO1FBQ0QsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0lBRUQsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDO0FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQWtCRztBQUNILFNBQWdCLFdBQVcsQ0FBQyxRQUFnQixFQUFFLEtBQWU7SUFDM0QsNkJBQTZCO0lBQzdCLElBQUksQ0FBQyxLQUFLLElBQUksS0FBSyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztRQUNqQyxPQUFPLEtBQUssQ0FBQztJQUNmLENBQUM7SUFFRCw4QkFBOEI7SUFDOUIsTUFBTSxjQUFjLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxLQUFLLE1BQU0sQ0FBQyxDQUFDO0lBRXZFLGtEQUFrRDtJQUNsRCxJQUFJLGNBQWMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7UUFDaEMsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0lBRUQsdUNBQXVDO0lBQ3ZDLE1BQU0sYUFBYSxHQUFhLEVBQUUsQ0FBQztJQUNuQyxNQUFNLGFBQWEsR0FBYSxFQUFFLENBQUM7SUFFbkMsS0FBSyxNQUFNLElBQUksSUFBSSxjQUFjLEVBQUUsQ0FBQztRQUNsQyxJQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUN6QixhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLHdCQUF3QjtRQUM3RCxDQUFDO2FBQU0sQ0FBQztZQUNOLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDM0IsQ0FBQztJQUNILENBQUM7SUFFRCw4Q0FBOEM7SUFDOUMsS0FBSyxNQUFNLE9BQU8sSUFBSSxhQUFhLEVBQUUsQ0FBQztRQUNwQyxJQUFJLFlBQVksQ0FBQyxRQUFRLEVBQUUsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNwQyw0QkFBNEI7WUFDNUIsT0FBTyxLQUFLLENBQUM7UUFDZixDQUFDO0lBQ0gsQ0FBQztJQUVELG1DQUFtQztJQUNuQyxNQUFNLFdBQVcsR0FBRyxhQUFhLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBRWhELElBQUksV0FBVyxFQUFFLENBQUM7UUFDaEIsa0VBQWtFO1FBQ2xFLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVELGlFQUFpRTtJQUNqRSxLQUFLLE1BQU0sT0FBTyxJQUFJLGFBQWEsRUFBRSxDQUFDO1FBQ3BDLElBQUksWUFBWSxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ3BDLE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQztJQUNILENBQUM7SUFFRCxpQkFBaUI7SUFDakIsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLy8gUnVsZSBlbmdpbmUgZm9yIGhvc3RuYW1lIG1hdGNoaW5nIGFuZCBwcm94eSBkZWNpc2lvblxuXG4vKipcbiAqIE1hdGNoIGEgaG9zdG5hbWUgYWdhaW5zdCBhIHBhdHRlcm4uXG4gKlxuICogU3VwcG9ydGVkIHBhdHRlcm5zOlxuICogLSAnKicgbWF0Y2hlcyBhbnkgaG9zdG5hbWVcbiAqIC0gJyouZXhhbXBsZS5jb20nIG1hdGNoZXMgc3ViZG9tYWlucyBvZiBleGFtcGxlLmNvbSAoYnV0IG5vdCBleGFtcGxlLmNvbSBpdHNlbGYpXG4gKiAtICdleGFtcGxlLmNvbScgZXhhY3QgbWF0Y2hcbiAqIC0gJ2dvb2dsZS4qJyBtYXRjaGVzIGdvb2dsZS5jb20sIGdvb2dsZS5jby51aywgZXRjLlxuICpcbiAqIEBwYXJhbSBob3N0bmFtZSAtIFRoZSBob3N0bmFtZSB0byBtYXRjaFxuICogQHBhcmFtIHBhdHRlcm4gLSBUaGUgcGF0dGVybiB0byBtYXRjaCBhZ2FpbnN0XG4gKiBAcmV0dXJucyB0cnVlIGlmIGhvc3RuYW1lIG1hdGNoZXMgcGF0dGVyblxuICovXG5leHBvcnQgZnVuY3Rpb24gbWF0Y2hQYXR0ZXJuKGhvc3RuYW1lOiBzdHJpbmcsIHBhdHRlcm46IHN0cmluZyk6IGJvb2xlYW4ge1xuICAvLyBOb3JtYWxpemUgaW5wdXRzIHRvIGxvd2VyY2FzZVxuICBjb25zdCBub3JtYWxpemVkSG9zdG5hbWUgPSBob3N0bmFtZS50b0xvd2VyQ2FzZSgpO1xuICBjb25zdCBub3JtYWxpemVkUGF0dGVybiA9IHBhdHRlcm4udG9Mb3dlckNhc2UoKTtcblxuICAvLyBVbml2ZXJzYWwgd2lsZGNhcmQgbWF0Y2hlcyBldmVyeXRoaW5nXG4gIGlmIChub3JtYWxpemVkUGF0dGVybiA9PT0gJyonKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvLyBFeGFjdCBtYXRjaFxuICBpZiAobm9ybWFsaXplZEhvc3RuYW1lID09PSBub3JtYWxpemVkUGF0dGVybikge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLy8gUHJlZml4IHdpbGRjYXJkOiAqLmV4YW1wbGUuY29tIG1hdGNoZXMgc3ViZG9tYWluc1xuICBpZiAobm9ybWFsaXplZFBhdHRlcm4uc3RhcnRzV2l0aCgnKi4nKSkge1xuICAgIGNvbnN0IHN1ZmZpeCA9IG5vcm1hbGl6ZWRQYXR0ZXJuLnNsaWNlKDEpOyAvLyAnLmV4YW1wbGUuY29tJ1xuICAgIC8vIE11c3QgZW5kIHdpdGggdGhlIHN1ZmZpeCBhbmQgaGF2ZSBzb21ldGhpbmcgYmVmb3JlIGl0XG4gICAgaWYgKG5vcm1hbGl6ZWRIb3N0bmFtZS5lbmRzV2l0aChzdWZmaXgpKSB7XG4gICAgICBjb25zdCBwcmVmaXggPSBub3JtYWxpemVkSG9zdG5hbWUuc2xpY2UoMCwgLXN1ZmZpeC5sZW5ndGgpO1xuICAgICAgLy8gUHJlZml4IG11c3Qgbm90IGJlIGVtcHR5IGFuZCBtdXN0IG5vdCBjb250YWluIGRvdHMgKHNpbmdsZSBsZXZlbCBzdWJkb21haW4gbWF0Y2gpXG4gICAgICAvLyBBY3R1YWxseSwgKi5leGFtcGxlLmNvbSBzaG91bGQgbWF0Y2ggZm9vLmJhci5leGFtcGxlLmNvbSB0b29cbiAgICAgIHJldHVybiBwcmVmaXgubGVuZ3RoID4gMDtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgLy8gU3VmZml4IHdpbGRjYXJkOiBnb29nbGUuKiBtYXRjaGVzIGdvb2dsZS5jb20sIGdvb2dsZS5jby51aywgZXRjLlxuICBpZiAobm9ybWFsaXplZFBhdHRlcm4uZW5kc1dpdGgoJy4qJykpIHtcbiAgICBjb25zdCBwcmVmaXggPSBub3JtYWxpemVkUGF0dGVybi5zbGljZSgwLCAtMik7IC8vICdnb29nbGUnXG4gICAgLy8gTXVzdCBzdGFydCB3aXRoIHByZWZpeCBmb2xsb3dlZCBieSBhIGRvdFxuICAgIGlmIChub3JtYWxpemVkSG9zdG5hbWUuc3RhcnRzV2l0aChwcmVmaXggKyAnLicpKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG4vKipcbiAqIERldGVybWluZSBpZiBhIGhvc3RuYW1lIHNob3VsZCBiZSBwcm94aWVkIGJhc2VkIG9uIHJ1bGVzLlxuICpcbiAqIFJ1bGVzIHNlbWFudGljczpcbiAqIC0gW10gKGVtcHR5KSDihpIgbm8gcHJveHkgKHJldHVybiBmYWxzZSlcbiAqIC0gWycqJ10g4oaSIHByb3h5IGV2ZXJ5dGhpbmdcbiAqIC0gWydleGFtcGxlLmNvbSddIOKGkiBwcm94eSBvbmx5IGV4YW1wbGUuY29tXG4gKiAtIFsnKi5nb29nbGUuY29tJ10g4oaSIHByb3h5IHN1YmRvbWFpbnMgb2YgZ29vZ2xlLmNvbVxuICogLSBbJyonLCAnLWV4YW1wbGUuY29tJ10g4oaSIHByb3h5IGV2ZXJ5dGhpbmcgZXhjZXB0IGV4YW1wbGUuY29tXG4gKiAtIFsnQVVUTycsICdleGFtcGxlLmNvbSddIOKGkiBBVVRPIGlzIHBsYWNlaG9sZGVyIChpZ25vcmVkKSwgcHJveHkgZXhhbXBsZS5jb21cbiAqXG4gKiBOZWdhdGl2ZSBwYXR0ZXJucyAocHJlZml4ZWQgd2l0aCAnLScpIGV4Y2x1ZGUgaG9zdHMgZnJvbSBwcm94eWluZy5cbiAqIElmICcqJyBpcyBpbiBydWxlcywgZGVmYXVsdCBpcyB0byBwcm94eSB1bmxlc3MgZXhjbHVkZWQuXG4gKiBXaXRob3V0ICcqJywgb25seSBleHBsaWNpdGx5IG1hdGNoZWQgcGF0dGVybnMgYXJlIHByb3hpZWQuXG4gKlxuICogQHBhcmFtIGhvc3RuYW1lIC0gVGhlIGhvc3RuYW1lIHRvIGNoZWNrXG4gKiBAcGFyYW0gcnVsZXMgLSBBcnJheSBvZiBydWxlIHBhdHRlcm5zXG4gKiBAcmV0dXJucyB0cnVlIGlmIHRoZSBob3N0bmFtZSBzaG91bGQgYmUgcHJveGllZFxuICovXG5leHBvcnQgZnVuY3Rpb24gc2hvdWxkUHJveHkoaG9zdG5hbWU6IHN0cmluZywgcnVsZXM6IHN0cmluZ1tdKTogYm9vbGVhbiB7XG4gIC8vIEVtcHR5IHJ1bGVzIG1lYW5zIG5vIHByb3h5XG4gIGlmICghcnVsZXMgfHwgcnVsZXMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgLy8gRmlsdGVyIG91dCBBVVRPIHBsYWNlaG9sZGVyXG4gIGNvbnN0IGVmZmVjdGl2ZVJ1bGVzID0gcnVsZXMuZmlsdGVyKChyKSA9PiByLnRvVXBwZXJDYXNlKCkgIT09ICdBVVRPJyk7XG5cbiAgLy8gSWYgbm8gZWZmZWN0aXZlIHJ1bGVzIGFmdGVyIGZpbHRlcmluZywgbm8gcHJveHlcbiAgaWYgKGVmZmVjdGl2ZVJ1bGVzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIC8vIFNlcGFyYXRlIHBvc2l0aXZlIGFuZCBuZWdhdGl2ZSBydWxlc1xuICBjb25zdCBuZWdhdGl2ZVJ1bGVzOiBzdHJpbmdbXSA9IFtdO1xuICBjb25zdCBwb3NpdGl2ZVJ1bGVzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIGZvciAoY29uc3QgcnVsZSBvZiBlZmZlY3RpdmVSdWxlcykge1xuICAgIGlmIChydWxlLnN0YXJ0c1dpdGgoJy0nKSkge1xuICAgICAgbmVnYXRpdmVSdWxlcy5wdXNoKHJ1bGUuc2xpY2UoMSkpOyAvLyBSZW1vdmUgdGhlICctJyBwcmVmaXhcbiAgICB9IGVsc2Uge1xuICAgICAgcG9zaXRpdmVSdWxlcy5wdXNoKHJ1bGUpO1xuICAgIH1cbiAgfVxuXG4gIC8vIENoZWNrIGlmIGhvc3RuYW1lIG1hdGNoZXMgYW55IG5lZ2F0aXZlIHJ1bGVcbiAgZm9yIChjb25zdCBuZWdSdWxlIG9mIG5lZ2F0aXZlUnVsZXMpIHtcbiAgICBpZiAobWF0Y2hQYXR0ZXJuKGhvc3RuYW1lLCBuZWdSdWxlKSkge1xuICAgICAgLy8gRXhjbHVkZWQgYnkgbmVnYXRpdmUgcnVsZVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIC8vIENoZWNrIGlmIHdlIGhhdmUgYSBjYXRjaC1hbGwgJyonXG4gIGNvbnN0IGhhc0NhdGNoQWxsID0gcG9zaXRpdmVSdWxlcy5pbmNsdWRlcygnKicpO1xuXG4gIGlmIChoYXNDYXRjaEFsbCkge1xuICAgIC8vIFdpdGggY2F0Y2gtYWxsLCBwcm94eSBldmVyeXRoaW5nIG5vdCBleGNsdWRlZCBieSBuZWdhdGl2ZSBydWxlc1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLy8gV2l0aG91dCBjYXRjaC1hbGwsIGNoZWNrIGlmIGhvc3RuYW1lIG1hdGNoZXMgYW55IHBvc2l0aXZlIHJ1bGVcbiAgZm9yIChjb25zdCBwb3NSdWxlIG9mIHBvc2l0aXZlUnVsZXMpIHtcbiAgICBpZiAobWF0Y2hQYXR0ZXJuKGhvc3RuYW1lLCBwb3NSdWxlKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG5cbiAgLy8gTm8gbWF0Y2ggZm91bmRcbiAgcmV0dXJuIGZhbHNlO1xufVxuXG4iXX0=