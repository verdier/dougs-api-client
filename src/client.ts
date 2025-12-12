import * as fs from 'node:fs';
import { promises as fsPromises } from 'node:fs';
import { makeEndpoints, Endpoints } from './endpoints';

// Constants
const DEFAULT_BASE_URL = "https://app.dougs.fr";
const DEFAULT_AUTH_URL = "https://app.dougs.fr/auth/api/login";
const DEFAULT_LOGIN_PAGE_URL = "https://app.dougs.fr/auth/login";
const DEFAULT_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:145.0) Gecko/20100101 Firefox/145.0";

export interface ClientConfig {
    email: string;
    password: string;
    baseUrl?: string;
    authUrl?: string;
    token?: string;
    cookies?: string[];
    sessionPath?: string;
    logger?: Logger;
}

export interface Logger {
    warn(message: string, ...args: any[]): void;
    log(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
}

export interface AuthState {
    token: string | null;
    cookies: string[];
}

/**
 * Builds default headers for API requests.
 */
function buildDefaultHeaders(): Record<string, string> {
    return {
        "User-Agent": DEFAULT_USER_AGENT,
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "fr,en;q=0.5",
        "Sec-GPC": "1",
        "Alt-Used": "app.dougs.fr",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "Pragma": "no-cache",
        "Cache-Control": "no-cache",
        "Origin": "https://app.dougs.fr",
        "Referer": "https://app.dougs.fr/app/dashboard",
    };
}

/**
 * Builds a URL with query parameters.
 */
function buildUrlWithQuery(baseUrl: string, query?: Record<string, any>): string {
    if (!query) {
        return baseUrl;
    }

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) {
            params.append(key, String(value));
        }
    }

    const queryString = params.toString();
    if (!queryString) {
        return baseUrl;
    }

    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}${queryString}`;
}

/**
 * Parses a cookie string to extract the name-value pair.
 */
function parseCookie(cookieStr: string): string {
    return cookieStr.split(';')[0].trim();
}

/**
 * Extracts the cookie name from a cookie string.
 */
function getCookieName(cookieStr: string): string {
    return cookieStr.split('=')[0];
}

export class Client {
    private readonly email: string;
    private readonly password: string;
    private readonly baseUrl: string;
    private readonly authUrl: string;
    private readonly loginPageUrl: string;
    private readonly logger: Logger;
    private token: string | null = null;
    private cookies: string[] = [];
    private readonly sessionPath: string | null = null;
    public readonly api: Endpoints;

    constructor(config: ClientConfig) {
        this.email = config.email;
        this.password = config.password;
        this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
        this.authUrl = config.authUrl ?? DEFAULT_AUTH_URL;
        this.loginPageUrl = DEFAULT_LOGIN_PAGE_URL;
        this.logger = config.logger ?? console;
        this.token = config.token ?? null;
        this.cookies = config.cookies ?? [];
        this.sessionPath = config.sessionPath ?? null;

        // Load session synchronously in constructor (session is optional)
        this.loadSessionSync();
        this.api = makeEndpoints(this);
    }

    /**
     * Returns the current authentication state.
     */
    public getAuthState(): AuthState {
        return {
            token: this.token,
            cookies: [...this.cookies], // Return a copy to prevent external mutation
        };
    }

    /**
     * Loads session from disk synchronously (called in constructor).
     */
    private loadSessionSync(): void {
        if (!this.sessionPath) {
            return;
        }

        try {
            const sessionData = fs.readFileSync(this.sessionPath, 'utf8');
            const session = JSON.parse(sessionData) as Partial<AuthState>;
            
            if (session.cookies && Array.isArray(session.cookies)) {
                this.cookies = session.cookies;
            }
            if (session.token !== undefined) {
                this.token = session.token;
            }
        } catch (error) {
            // File doesn't exist or is invalid - that's okay, session is optional
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                this.logger.warn(`Failed to load session from ${this.sessionPath}`, error);
            }
        }
    }

    /**
     * Saves the current session to disk asynchronously.
     */
    private async saveSession(): Promise<void> {
        if (!this.sessionPath) {
            return;
        }

        try {
            const sessionData = JSON.stringify(this.getAuthState(), null, 2);
            await fsPromises.writeFile(this.sessionPath, sessionData, { encoding: 'utf8' });
        } catch (error) {
            this.logger.warn(`Failed to save session to ${this.sessionPath}`, error);
        }
    }

    /**
     * Builds request headers with cookies and custom headers merged in.
     */
    private buildHeaders(customHeaders?: Record<string, string>): Record<string, string> {
        const headers = {
            ...buildDefaultHeaders(),
            ...(customHeaders ?? {}),
        };

        if (this.cookies.length > 0) {
            headers["Cookie"] = this.cookies.join('; ');
        }

        return headers;
    }

    /**
     * Adds or updates a cookie in the cookie store.
     */
    private addCookie(cookieStr: string): void {
        const cookieName = getCookieName(cookieStr);
        // Remove existing cookie with same name
        this.cookies = this.cookies.filter(c => getCookieName(c) !== cookieName);
        this.cookies.push(cookieStr);
    }

    /**
     * Processes Set-Cookie headers and adds them to the cookie store.
     */
    private processSetCookieHeaders(setCookieHeaders: string[]): void {
        for (const cookieHeader of setCookieHeaders) {
            const cookie = parseCookie(cookieHeader);
            this.addCookie(cookie);
        }
    }

    /**
     * Makes an HTTP request with automatic retry on 401.
     */
    private async request<TRawDTO = any>(
        path: string,
        options: RequestInit = {},
        retry = true
    ): Promise<TRawDTO> {
        const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
        const headers = this.buildHeaders(options.headers as Record<string, string> | undefined);

        const response = await fetch(url, {
            ...options,
            headers,
        });

        if (!response.ok) {
            if (response.status === 401 && !path.includes('/login') && retry) {
                this.logger.log("Unauthorized access (401). Attempting re-login...");
                try {
                    await this.login();
                    // Retry the request once with new cookies
                    return this.request<TRawDTO>(path, options, false);
                } catch (loginError) {
                    this.logger.error("Auto-login failed:", loginError);
                    // Fall through to throw the original error
                }
            }

            const errorText = await response.text();
            throw new Error(
                `Request failed: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`
            );
        }

        return response.json() as Promise<TRawDTO>;
    }

    /**
     * Performs login and establishes an authenticated session.
     */
    async login(): Promise<void> {
        if (!this.email || !this.password) {
            throw new Error("Email and password are required for login.");
        }

        // Visit the login page first to get initial cookies (CSRF etc)
        const initialResponse = await fetch(this.loginPageUrl, {
            method: "GET",
            headers: {
                "User-Agent": DEFAULT_USER_AGENT,
            },
        });

        // Capture initial cookies
        const initialCookies = initialResponse.headers.getSetCookie();
        this.processSetCookieHeaders(initialCookies);

        // Perform login request
        const loginHeaders = this.buildHeaders({
            "Content-Type": "application/json",
        });

        const response = await fetch(this.authUrl, {
            method: "POST",
            headers: loginHeaders,
            body: JSON.stringify({
                email: this.email,
                password: this.password,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `Login failed: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`
            );
        }

        // Capture authentication cookies
        const authCookies = response.headers.getSetCookie();
        this.processSetCookieHeaders(authCookies);

        // Extract token if present
        const data = await response.json() as { accessToken?: string };
        if (data.accessToken) {
            this.token = data.accessToken;
        }

        await this.saveSession();
    }

    /**
     * Performs a GET request.
     */
    get<TRawDTO = any>(path: string, query?: Record<string, any>): Promise<TRawDTO> {
        const url = buildUrlWithQuery(path, query);
        return this.request<TRawDTO>(url, { method: "GET" });
    }

    /**
     * Performs a POST request.
     */
    post<TRawDTO = any>(path: string, body: any): Promise<TRawDTO> {
        return this.request<TRawDTO>(path, {
            method: "POST",
            body: JSON.stringify(body),
            headers: { "Content-Type": "application/json" },
        });
    }

    /**
     * Performs a DELETE request.
     */
    delete<TRawDTO = any>(path: string): Promise<TRawDTO> {
        return this.request<TRawDTO>(path, {
            method: "DELETE",
        });
    }
}
