// Session management for maintaining cookies across proxy requests

interface SessionData {
  cookies: Map<string, string>;
  lastAccess: number;
}

class SessionStore {
  private sessions = new Map<string, SessionData>();
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  constructor() {
    // Clean up expired sessions every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  private cleanup() {
    const now = Date.now();
    for (const [sessionId, data] of this.sessions.entries()) {
      if (now - data.lastAccess > this.SESSION_TIMEOUT) {
        this.sessions.delete(sessionId);
      }
    }
  }

  private getSessionId(headers: Headers): string {
    // Use a combination of User-Agent and X-Forwarded-For to identify sessions
    const userAgent = headers.get('User-Agent') || 'unknown';
    const forwardedFor = headers.get('X-Forwarded-For') || headers.get('X-Real-IP') || 'unknown';
    return `${userAgent}-${forwardedFor}`.replace(/[^a-zA-Z0-9-]/g, '').substring(0, 64);
  }

  getSession(headers: Headers): SessionData {
    const sessionId = this.getSessionId(headers);
    console.log(`[Session] Getting session for ID: ${sessionId}`);
    let session = this.sessions.get(sessionId);
    
    if (!session) {
      console.log(`[Session] Creating new session for ID: ${sessionId}`);
      session = {
        cookies: new Map(),
        lastAccess: Date.now()
      };
      this.sessions.set(sessionId, session);
    } else {
      console.log(`[Session] Found existing session with ${session.cookies.size} cookies`);
      session.lastAccess = Date.now();
    }
    
    return session;
  }

  updateSessionCookies(headers: Headers, setCookieHeaders: string[]) {
    const session = this.getSession(headers);
    console.log(`[Session] Updating cookies with ${setCookieHeaders.length} Set-Cookie headers`);
    
    for (const cookieHeader of setCookieHeaders) {
      console.log(`[Session] Processing Set-Cookie: ${cookieHeader}`);
      // Parse cookie name and value
      const [nameValue] = cookieHeader.split(';');
      const [name, value] = nameValue.split('=', 2);
      
      if (name && value !== undefined) {
        const cookieName = name.trim();
        const cookieValue = value.trim();
        session.cookies.set(cookieName, cookieValue);
        console.log(`[Session] Stored cookie: ${cookieName}=${cookieValue}`);
      }
    }
    console.log(`[Session] Total cookies in session: ${session.cookies.size}`);
  }

  getSessionCookies(headers: Headers): string {
    const session = this.getSession(headers);
    const cookiePairs: string[] = [];
    
    for (const [name, value] of session.cookies.entries()) {
      cookiePairs.push(`${name}=${value}`);
    }
    
    const cookieString = cookiePairs.join('; ');
    console.log(`[Session] Returning cookies: ${cookieString}`);
    return cookieString;
  }
}

// Global session store instance
export const sessionStore = new SessionStore();