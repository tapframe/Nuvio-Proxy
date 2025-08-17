import { getBodyBuffer } from '@/utils/body';
import {
  getProxyHeaders,
  getAfterResponseHeaders,
  getBlacklistedHeaders,
} from '@/utils/headers';
import {
  createTokenIfNeeded,
  isAllowedToMakeRequest,
  setTokenHeader,
} from '@/utils/turnstile';
import { sessionStore } from '@/utils/session';

export default defineEventHandler(async (event) => {
  // Handle preflight CORS requests
  if (isPreflightRequest(event)) {
    handleCors(event, {});
    // Ensure the response ends here for preflight
    event.node.res.statusCode = 204;
    event.node.res.end();
    return;
  }

  // Reject any other OPTIONS requests
  if (event.node.req.method === 'OPTIONS') {
    throw createError({
      statusCode: 405,
      statusMessage: 'Method Not Allowed',
    });
  }

  // Parse destination URL
  const destination = getQuery<{ destination?: string }>(event).destination;
  if (!destination) {
    return await sendJson({
      event,
      status: 200,
      data: {
        message: `Proxy is working as expected (v${
          useRuntimeConfig(event).version
        })`,
      },
    });
  }

  // Check if allowed to make the request
  if (!(await isAllowedToMakeRequest(event))) {
    return await sendJson({
      event,
      status: 401,
      data: {
        error: 'Invalid or missing token',
      },
    });
  }

  // Read body and create token if needed
  const body = await getBodyBuffer(event);
  const token = await createTokenIfNeeded(event);

  // Get session cookies and merge with request headers
  const sessionCookies = sessionStore.getSessionCookies(event.headers);
  const proxyHeaders = getProxyHeaders(event.headers);
  
  // Log incoming cookies from client
  const incomingCookies = proxyHeaders.get('Cookie');
  if (incomingCookies) {
    console.log(`[Proxy] Incoming cookies from client: ${incomingCookies}`);
  }
  
  // Merge session cookies with existing cookies
  if (sessionCookies) {
    const existingCookies = proxyHeaders.get('Cookie') || '';
    const mergedCookies = existingCookies ? `${existingCookies}; ${sessionCookies}` : sessionCookies;
    proxyHeaders.set('Cookie', mergedCookies);
    console.log(`[Proxy] Final merged cookies: ${mergedCookies}`);
  } else if (incomingCookies) {
    console.log(`[Proxy] Using only incoming cookies: ${incomingCookies}`);
  }

  // Proxy the request
  try {
    await specificProxyRequest(event, destination, {
      blacklistedHeaders: getBlacklistedHeaders(),
      fetchOptions: {
        redirect: 'follow',
        headers: proxyHeaders,
        body,
      },
      onResponse(outputEvent, response) {
        // Debug: Log all response headers
        console.log(`[Proxy] Response headers for ${response.url}:`);
        response.headers.forEach((value, key) => {
          console.log(`[Proxy] ${key}: ${value}`);
        });
        
        // Extract and store Set-Cookie headers for session management
        const setCookieHeaders: string[] = [];
        response.headers.forEach((value, key) => {
          if (key.toLowerCase() === 'set-cookie') {
            setCookieHeaders.push(value);
          }
        });
        
        console.log(`[Proxy] Found ${setCookieHeaders.length} Set-Cookie headers`);
        if (setCookieHeaders.length > 0) {
          sessionStore.updateSessionCookies(event.headers, setCookieHeaders);
        }
        
        const headers = getAfterResponseHeaders(response.headers, response.url);
        setResponseHeaders(outputEvent, headers);
        if (token) setTokenHeader(event, token);
      },
    });
  } catch (e) {
    console.log('Error fetching', e);
    throw e;
  }
});