"use strict";
// HTTP client wrapper for Aluvia API
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUser = getUser;
/**
 * Fetch user configuration from the Aluvia API.
 *
 * @param apiBaseUrl - Base URL for the Aluvia API (e.g., 'https://api.aluvia.io')
 * @param token - User API token (Bearer token)
 * @param etag - Optional ETag for conditional request (If-None-Match)
 * @returns GetUserResult with status, etag, and body (null on 304)
 */
async function getUser(apiBaseUrl, token, etag) {
    // Build URL, ensuring no trailing slash duplication
    const url = `${apiBaseUrl.replace(/\/$/, '')}/user`;
    // Build headers
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
    };
    // Add If-None-Match header for conditional requests
    if (etag) {
        headers['If-None-Match'] = etag;
    }
    // Make the request
    const response = await fetch(url, {
        method: 'GET',
        headers,
    });
    // Extract ETag from response headers
    const responseEtag = response.headers.get('etag');
    // Handle 304 Not Modified
    if (response.status === 304) {
        return {
            status: 304,
            etag: responseEtag,
            body: null,
        };
    }
    // For 200 OK, parse the JSON body
    if (response.status === 200) {
        const body = (await response.json());
        return {
            status: 200,
            etag: responseEtag,
            body,
        };
    }
    // For other statuses (401, 403, 4xx, 5xx), return status without body
    return {
        status: response.status,
        etag: responseEtag,
        body: null,
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaHR0cENsaWVudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9odHRwQ2xpZW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSxxQ0FBcUM7O0FBOEJyQywwQkFxREM7QUE3REQ7Ozs7Ozs7R0FPRztBQUNJLEtBQUssVUFBVSxPQUFPLENBQzNCLFVBQWtCLEVBQ2xCLEtBQWEsRUFDYixJQUFhO0lBRWIsb0RBQW9EO0lBQ3BELE1BQU0sR0FBRyxHQUFHLEdBQUcsVUFBVSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLE9BQU8sQ0FBQztJQUVwRCxnQkFBZ0I7SUFDaEIsTUFBTSxPQUFPLEdBQTJCO1FBQ3RDLGVBQWUsRUFBRSxVQUFVLEtBQUssRUFBRTtRQUNsQyxRQUFRLEVBQUUsa0JBQWtCO0tBQzdCLENBQUM7SUFFRixvREFBb0Q7SUFDcEQsSUFBSSxJQUFJLEVBQUUsQ0FBQztRQUNULE9BQU8sQ0FBQyxlQUFlLENBQUMsR0FBRyxJQUFJLENBQUM7SUFDbEMsQ0FBQztJQUVELG1CQUFtQjtJQUNuQixNQUFNLFFBQVEsR0FBRyxNQUFNLEtBQUssQ0FBQyxHQUFHLEVBQUU7UUFDaEMsTUFBTSxFQUFFLEtBQUs7UUFDYixPQUFPO0tBQ1IsQ0FBQyxDQUFDO0lBRUgscUNBQXFDO0lBQ3JDLE1BQU0sWUFBWSxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBRWxELDBCQUEwQjtJQUMxQixJQUFJLFFBQVEsQ0FBQyxNQUFNLEtBQUssR0FBRyxFQUFFLENBQUM7UUFDNUIsT0FBTztZQUNMLE1BQU0sRUFBRSxHQUFHO1lBQ1gsSUFBSSxFQUFFLFlBQVk7WUFDbEIsSUFBSSxFQUFFLElBQUk7U0FDWCxDQUFDO0lBQ0osQ0FBQztJQUVELGtDQUFrQztJQUNsQyxJQUFJLFFBQVEsQ0FBQyxNQUFNLEtBQUssR0FBRyxFQUFFLENBQUM7UUFDNUIsTUFBTSxJQUFJLEdBQUcsQ0FBQyxNQUFNLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBb0IsQ0FBQztRQUN4RCxPQUFPO1lBQ0wsTUFBTSxFQUFFLEdBQUc7WUFDWCxJQUFJLEVBQUUsWUFBWTtZQUNsQixJQUFJO1NBQ0wsQ0FBQztJQUNKLENBQUM7SUFFRCxzRUFBc0U7SUFDdEUsT0FBTztRQUNMLE1BQU0sRUFBRSxRQUFRLENBQUMsTUFBTTtRQUN2QixJQUFJLEVBQUUsWUFBWTtRQUNsQixJQUFJLEVBQUUsSUFBSTtLQUNYLENBQUM7QUFDSixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLy8gSFRUUCBjbGllbnQgd3JhcHBlciBmb3IgQWx1dmlhIEFQSVxuXG4vKipcbiAqIFJlc3BvbnNlIHNoYXBlIGZyb20gR0VUIC91c2VyIGVuZHBvaW50LlxuICovXG5leHBvcnQgdHlwZSBVc2VyQXBpUmVzcG9uc2UgPSB7XG4gIHByb3h5X3VzZXJuYW1lOiBzdHJpbmc7XG4gIHByb3h5X3Bhc3N3b3JkOiBzdHJpbmc7XG4gIHJ1bGVzOiBzdHJpbmdbXTtcbiAgc2Vzc2lvbl9pZDogc3RyaW5nIHwgbnVsbDtcbiAgdGFyZ2V0X2dlbzogc3RyaW5nIHwgbnVsbDtcbn07XG5cbi8qKlxuICogUmVzdWx0IGZyb20gZ2V0VXNlcigpIGNhbGwuXG4gKi9cbmV4cG9ydCB0eXBlIEdldFVzZXJSZXN1bHQgPSB7XG4gIHN0YXR1czogbnVtYmVyO1xuICBldGFnOiBzdHJpbmcgfCBudWxsO1xuICBib2R5OiBVc2VyQXBpUmVzcG9uc2UgfCBudWxsO1xufTtcblxuLyoqXG4gKiBGZXRjaCB1c2VyIGNvbmZpZ3VyYXRpb24gZnJvbSB0aGUgQWx1dmlhIEFQSS5cbiAqXG4gKiBAcGFyYW0gYXBpQmFzZVVybCAtIEJhc2UgVVJMIGZvciB0aGUgQWx1dmlhIEFQSSAoZS5nLiwgJ2h0dHBzOi8vYXBpLmFsdXZpYS5pbycpXG4gKiBAcGFyYW0gdG9rZW4gLSBVc2VyIEFQSSB0b2tlbiAoQmVhcmVyIHRva2VuKVxuICogQHBhcmFtIGV0YWcgLSBPcHRpb25hbCBFVGFnIGZvciBjb25kaXRpb25hbCByZXF1ZXN0IChJZi1Ob25lLU1hdGNoKVxuICogQHJldHVybnMgR2V0VXNlclJlc3VsdCB3aXRoIHN0YXR1cywgZXRhZywgYW5kIGJvZHkgKG51bGwgb24gMzA0KVxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0VXNlcihcbiAgYXBpQmFzZVVybDogc3RyaW5nLFxuICB0b2tlbjogc3RyaW5nLFxuICBldGFnPzogc3RyaW5nXG4pOiBQcm9taXNlPEdldFVzZXJSZXN1bHQ+IHtcbiAgLy8gQnVpbGQgVVJMLCBlbnN1cmluZyBubyB0cmFpbGluZyBzbGFzaCBkdXBsaWNhdGlvblxuICBjb25zdCB1cmwgPSBgJHthcGlCYXNlVXJsLnJlcGxhY2UoL1xcLyQvLCAnJyl9L3VzZXJgO1xuXG4gIC8vIEJ1aWxkIGhlYWRlcnNcbiAgY29uc3QgaGVhZGVyczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICAnQXV0aG9yaXphdGlvbic6IGBCZWFyZXIgJHt0b2tlbn1gLFxuICAgICdBY2NlcHQnOiAnYXBwbGljYXRpb24vanNvbicsXG4gIH07XG5cbiAgLy8gQWRkIElmLU5vbmUtTWF0Y2ggaGVhZGVyIGZvciBjb25kaXRpb25hbCByZXF1ZXN0c1xuICBpZiAoZXRhZykge1xuICAgIGhlYWRlcnNbJ0lmLU5vbmUtTWF0Y2gnXSA9IGV0YWc7XG4gIH1cblxuICAvLyBNYWtlIHRoZSByZXF1ZXN0XG4gIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godXJsLCB7XG4gICAgbWV0aG9kOiAnR0VUJyxcbiAgICBoZWFkZXJzLFxuICB9KTtcblxuICAvLyBFeHRyYWN0IEVUYWcgZnJvbSByZXNwb25zZSBoZWFkZXJzXG4gIGNvbnN0IHJlc3BvbnNlRXRhZyA9IHJlc3BvbnNlLmhlYWRlcnMuZ2V0KCdldGFnJyk7XG5cbiAgLy8gSGFuZGxlIDMwNCBOb3QgTW9kaWZpZWRcbiAgaWYgKHJlc3BvbnNlLnN0YXR1cyA9PT0gMzA0KSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN0YXR1czogMzA0LFxuICAgICAgZXRhZzogcmVzcG9uc2VFdGFnLFxuICAgICAgYm9keTogbnVsbCxcbiAgICB9O1xuICB9XG5cbiAgLy8gRm9yIDIwMCBPSywgcGFyc2UgdGhlIEpTT04gYm9keVxuICBpZiAocmVzcG9uc2Uuc3RhdHVzID09PSAyMDApIHtcbiAgICBjb25zdCBib2R5ID0gKGF3YWl0IHJlc3BvbnNlLmpzb24oKSkgYXMgVXNlckFwaVJlc3BvbnNlO1xuICAgIHJldHVybiB7XG4gICAgICBzdGF0dXM6IDIwMCxcbiAgICAgIGV0YWc6IHJlc3BvbnNlRXRhZyxcbiAgICAgIGJvZHksXG4gICAgfTtcbiAgfVxuXG4gIC8vIEZvciBvdGhlciBzdGF0dXNlcyAoNDAxLCA0MDMsIDR4eCwgNXh4KSwgcmV0dXJuIHN0YXR1cyB3aXRob3V0IGJvZHlcbiAgcmV0dXJuIHtcbiAgICBzdGF0dXM6IHJlc3BvbnNlLnN0YXR1cyxcbiAgICBldGFnOiByZXNwb25zZUV0YWcsXG4gICAgYm9keTogbnVsbCxcbiAgfTtcbn1cblxuIl19