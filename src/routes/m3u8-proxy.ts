import { setResponseHeaders } from 'h3';

function parseURL(req_url: string, baseUrl?: string) {
  if (baseUrl) {
    return new URL(req_url, baseUrl).href;
  }
  
  const match = req_url.match(/^(?:(https?:)?\/\/)?(([^\/?]+?)(?::(\d{0,5})(?=[\/?]|$))?)([\/?][\S\s]*|$)/i);
  
  if (!match) {
    return null;
  }
  
  if (!match[1]) {
    if (/^https?:/i.test(req_url)) {
      return null;
    }
    
    // Scheme is omitted
    if (req_url.lastIndexOf("//", 0) === -1) {
      // "//" is omitted
      req_url = "//" + req_url;
    }
    req_url = (match[4] === "443" ? "https:" : "http:") + req_url;
  }
  
  try {
    const parsed = new URL(req_url);
    if (!parsed.hostname) {
      // "http://:1/" and "http:/notenoughslashes" could end up here
      return null;
    }
    return parsed.href;
  } catch (error) {
    return null;
  }
}

/**
 * Proxies m3u8 files and replaces the content to point to the proxy
 */
async function proxyM3U8(event: any) {
  const url = getQuery(event).url as string;
  const headersParam = getQuery(event).headers as string;
  
  if (!url) {
    return sendError(event, createError({
      statusCode: 400,
      statusMessage: 'URL parameter is required'
    }));
  }
  
  let headers = {};
  try {
    headers = headersParam ? JSON.parse(headersParam) : {};
  } catch (e) {
    return sendError(event, createError({
      statusCode: 400,
      statusMessage: 'Invalid headers format'
    }));
  }
  
  try {
    const response = await globalThis.fetch(url, {
      headers: {
        // Default User-Agent (from src/utils/headers.ts)
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:93.0) Gecko/20100101 Firefox/93.0',
        ...(headers as HeadersInit),
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch M3U8: ${response.status} ${response.statusText}`);
    }
    
    const m3u8Content = await response.text();
    
    // Get the base URL for the host
    const host = getRequestHost(event);
    const proto = getRequestProtocol(event);
    const baseProxyUrl = `${proto}://${host}`;
    
    if (m3u8Content.includes("RESOLUTION=")) {
      // This is a master playlist with multiple quality variants
      const lines = m3u8Content.split("\n");
      const newLines: string[] = [];
      
      for (const line of lines) {
        if (line.startsWith("#")) {
          if (line.startsWith("#EXT-X-KEY:")) {
            // Proxy the key URL
            const regex = /https?:\/\/[^\""\s]+/g;
            const keyUrl = regex.exec(line)?.[0];
            if (keyUrl) {
              const proxyKeyUrl = `${baseProxyUrl}/ts-proxy?url=${encodeURIComponent(keyUrl)}&headers=${encodeURIComponent(JSON.stringify(headers))}`;
              newLines.push(line.replace(keyUrl, proxyKeyUrl));
            } else {
              newLines.push(line);
            }
          } else if (line.startsWith("#EXT-X-MEDIA:")) {
            // Proxy alternative media URLs (like audio streams)
            const regex = /https?:\/\/[^\""\s]+/g;
            const mediaUrl = regex.exec(line)?.[0];
            if (mediaUrl) {
              const proxyMediaUrl = `${baseProxyUrl}/m3u8-proxy?url=${encodeURIComponent(mediaUrl)}&headers=${encodeURIComponent(JSON.stringify(headers))}`;
              newLines.push(line.replace(mediaUrl, proxyMediaUrl));
            } else {
              newLines.push(line);
            }
          } else {
            newLines.push(line);
          }
        } else if (line.trim()) {
          // This is a quality variant URL
          const variantUrl = parseURL(line, url);
          if (variantUrl) {
            newLines.push(`${baseProxyUrl}/m3u8-proxy?url=${encodeURIComponent(variantUrl)}&headers=${encodeURIComponent(JSON.stringify(headers))}`);
          } else {
            newLines.push(line);
          }
        } else {
          // Empty line, preserve it
          newLines.push(line);
        }
      }
      
      // Set appropriate headers
      setResponseHeaders(event, {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
      
      return newLines.join("\n");
    } else {
      // This is a media playlist with segments
      const lines = m3u8Content.split("\n");
      const newLines: string[] = [];
      
      for (const line of lines) {
        if (line.startsWith("#")) {
          if (line.startsWith("#EXT-X-KEY:")) {
            // Proxy the key URL
            const regex = /https?:\/\/[^\""\s]+/g;
            const keyUrl = regex.exec(line)?.[0];
            if (keyUrl) {
              const proxyKeyUrl = `${baseProxyUrl}/ts-proxy?url=${encodeURIComponent(keyUrl)}&headers=${encodeURIComponent(JSON.stringify(headers))}`;
              newLines.push(line.replace(keyUrl, proxyKeyUrl));
            } else {
              newLines.push(line);
            }
          } else {
            newLines.push(line);
          }
        } else if (line.trim() && !line.startsWith("#")) {
          // This is a segment URL (.ts file)
          const segmentUrl = parseURL(line, url);
          if (segmentUrl) {
            newLines.push(`${baseProxyUrl}/ts-proxy?url=${encodeURIComponent(segmentUrl)}&headers=${encodeURIComponent(JSON.stringify(headers))}`);
          } else {
            newLines.push(line);
          }
        } else {
          // Comment or empty line, preserve it
          newLines.push(line);
        }
      }
      
      // Set appropriate headers
      setResponseHeaders(event, {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
      
      return newLines.join("\n");
    }
  } catch (error: any) {
    console.error('Error proxying M3U8:', error);
    return sendError(event, createError({
      statusCode: 500,
      statusMessage: error.message || 'Error proxying M3U8 file'
    }));
  }
}

export default defineEventHandler(async (event) => {
  // Handle CORS preflight requests
  if (isPreflightRequest(event)) return handleCors(event, {});
  
  return await proxyM3U8(event);
}); 