import * as fs from 'node:fs';
import { promises as fsPromises } from 'node:fs';
import { makeEndpoints, Endpoints } from './endpoints';

const DEFAULT_BASE_URL = "https://app.dougs.fr";
const DEFAULT_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:145.0) Gecko/20100101 Firefox/145.0";
const MAX_TRUSTED_REDIRECTS = 5;
const MAX_DOWNLOAD_REDIRECTS = 5;

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

function buildDefaultHeaders(origin: string): Record<string, string> {
    return {
        "User-Agent": DEFAULT_USER_AGENT,
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "fr,en;q=0.5",
        "Sec-GPC": "1",
        "Alt-Used": new URL(origin).host,
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "Pragma": "no-cache",
        "Cache-Control": "no-cache",
        "Origin": origin,
        "Referer": `${origin}/app/dashboard`,
    };
}

function buildUrlWithQuery(baseUrl: string, query?: Record<string, any>): string {
    if (!query) return baseUrl;

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) params.append(key, String(value));
    }

    const queryString = params.toString();
    if (!queryString) return baseUrl;
    return `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${queryString}`;
}

function parseCookie(cookieStr: string): string {
    return cookieStr.split(';')[0].trim();
}

function getCookieName(cookieStr: string): string {
    return cookieStr.split('=')[0];
}

/**
 * The configured base URL is the sole trusted origin for authenticated traffic.
 * URLs with embedded credentials and non-HTTPS origins are deliberately rejected.
 */
function parseTrustedBaseUrl(value: string): URL {
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        throw new Error("Dougs base URL must be a valid HTTPS URL.");
    }

    if (url.protocol !== 'https:' || url.username || url.password) {
        throw new Error("Dougs base URL must be a credential-free HTTPS URL.");
    }
    return url;
}

export class Client {
    private readonly email: string;
    private readonly password: string;
    private readonly baseUrl: URL;
    private readonly trustedOrigin: string;
    private readonly authUrl: URL;
    private readonly loginPageUrl: URL;
    private readonly logger: Logger;
    private token: string | null = null;
    private cookies: string[] = [];
    private readonly sessionPath: string | null = null;
    public readonly api: Endpoints;

    constructor(config: ClientConfig) {
        this.email = config.email;
        this.password = config.password;
        this.baseUrl = parseTrustedBaseUrl(config.baseUrl ?? DEFAULT_BASE_URL);
        this.trustedOrigin = this.baseUrl.origin;
        this.authUrl = this.resolveTrustedUrl(config.authUrl ?? '/auth/api/login');
        this.loginPageUrl = this.resolveTrustedUrl('/auth/login');
        this.logger = config.logger ?? console;
        this.token = config.token ?? null;
        this.cookies = config.cookies ?? [];
        this.sessionPath = config.sessionPath ?? null;

        this.loadSessionSync();
        this.api = makeEndpoints(this);
    }

    public getAuthState(): AuthState {
        return { token: this.token, cookies: [...this.cookies] };
    }

    private assertTrustedUrl(url: URL): void {
        if (url.protocol !== 'https:' || url.origin !== this.trustedOrigin || url.username || url.password) {
            throw new Error("Dougs request URL must use the configured Dougs HTTPS origin.");
        }
    }

    /** Resolves a public path but never permits it to escape the trusted origin. */
    private resolveTrustedUrl(path: string): URL {
        let url: URL;
        try {
            url = new URL(path, this.baseUrl);
        } catch {
            throw new Error("Dougs request URL must be a valid HTTPS URL or relative path.");
        }

        this.assertTrustedUrl(url);
        return url;
    }

    /**
     * Follows redirects only after verifying the next hop is the configured
     * HTTPS origin. Keeping redirect handling manual prevents Fetch from ever
     * forwarding credentials, cookies, or mutation bodies to another origin.
     */
    private async fetchTrusted(
        url: URL,
        options: RequestInit,
        onResponse?: (response: Response) => void,
    ): Promise<Response> {
        let currentUrl = url;
        let currentMethod = (options.method ?? 'GET').toUpperCase();
        let currentBody = options.body;
        let dropBodyHeaders = false;
        let redirects = 0;
        // Cookies belong to the client session, not to one redirect hop. Rebuild
        // the trusted headers for each request so Set-Cookie is immediately used.
        const customHeaders: Record<string, string> = {};
        new Headers(options.headers).forEach((value, name) => { customHeaders[name] = value; });
        delete customHeaders.cookie;

        while (true) {
            this.assertTrustedUrl(currentUrl);
            const headers = this.buildHeaders(customHeaders);
            if (dropBodyHeaders) {
                delete headers['content-type'];
                delete headers['content-length'];
                delete headers['transfer-encoding'];
                delete headers['content-encoding'];
            }
            const response = await fetch(currentUrl, {
                ...options,
                method: currentMethod,
                body: currentBody,
                headers,
                redirect: 'manual',
            });
            onResponse?.(response);

            if (![301, 302, 303, 307, 308].includes(response.status)) return response;
            if (redirects >= MAX_TRUSTED_REDIRECTS) {
                throw new Error("Dougs request failed: too many redirects.");
            }

            const location = response.headers.get('location');
            if (!location) throw new Error("Dougs request failed: redirect missing location.");

            let nextUrl: URL;
            try {
                nextUrl = new URL(location, currentUrl);
            } catch {
                throw new Error("Dougs request failed: invalid redirect URL.");
            }
            // Validate before assigning or issuing the next request. In
            // particular, POST bodies and session headers never leave Dougs.
            this.assertTrustedUrl(nextUrl);

            if (
                ((response.status === 301 || response.status === 302) && currentMethod === 'POST') ||
                (response.status === 303 && currentMethod !== 'HEAD')
            ) {
                currentMethod = 'GET';
                currentBody = undefined;
                dropBodyHeaders = true;
            }

            currentUrl = nextUrl;
            redirects += 1;
        }
    }

    private loadSessionSync(): void {
        if (!this.sessionPath) return;

        try {
            const sessionData = fs.readFileSync(this.sessionPath, 'utf8');
            // Harden a pre-existing cache when the current user owns it. Failure to
            // chmod does not prevent a valid existing session from being used.
            try {
                fs.chmodSync(this.sessionPath, 0o600);
            } catch (error) {
                this.logger.warn(`Failed to secure session file ${this.sessionPath}`, error);
            }
            const session = JSON.parse(sessionData) as Partial<AuthState>;

            if (session.cookies && Array.isArray(session.cookies)) this.cookies = session.cookies;
            if (session.token !== undefined) this.token = session.token;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                this.logger.warn(`Failed to load session from ${this.sessionPath}`, error);
            }
        }
    }

    private async saveSession(): Promise<void> {
        if (!this.sessionPath) return;

        try {
            const sessionData = JSON.stringify(this.getAuthState(), null, 2);
            await fsPromises.writeFile(this.sessionPath, sessionData, { encoding: 'utf8', mode: 0o600 });
            // writeFile's mode only applies to new files; enforce it for caches
            // created by older releases too.
            await fsPromises.chmod(this.sessionPath, 0o600);
        } catch (error) {
            this.logger.warn(`Failed to save session to ${this.sessionPath}`, error);
        }
    }

    private buildHeaders(customHeaders?: Record<string, string>): Record<string, string> {
        const headers = {
            ...buildDefaultHeaders(this.trustedOrigin),
            ...(customHeaders ?? {}),
        };
        if (this.cookies.length > 0) headers.Cookie = this.cookies.join('; ');
        return headers;
    }

    private addCookie(cookieStr: string): void {
        const cookieName = getCookieName(cookieStr);
        this.cookies = this.cookies.filter(c => getCookieName(c) !== cookieName);
        this.cookies.push(cookieStr);
    }

    private processSetCookieHeaders(setCookieHeaders: string[]): void {
        for (const cookieHeader of setCookieHeaders) this.addCookie(parseCookie(cookieHeader));
    }

    private async request<TRawDTO = any>(
        path: string,
        options: RequestInit = {},
        retry = true,
    ): Promise<TRawDTO> {
        const url = this.resolveTrustedUrl(path);
        const headers = this.buildHeaders(options.headers as Record<string, string> | undefined);
        const response = await this.fetchTrusted(url, { ...options, headers });

        if (!response.ok) {
            if (response.status === 401 && !url.pathname.includes('/login') && retry) {
                this.logger.log("Unauthorized access (401). Attempting re-login...");
                try {
                    await this.login();
                    return this.request<TRawDTO>(path, options, false);
                } catch (loginError) {
                    this.logger.error("Auto-login failed:", loginError);
                }
            }
            // Never include upstream response bodies in errors: they can contain
            // financial data, cookies, tokens, or provider diagnostics.
            throw new Error(`Dougs request failed (HTTP ${response.status}).`);
        }

        return response.json() as Promise<TRawDTO>;
    }

    async login(): Promise<void> {
        if (!this.email || !this.password) throw new Error("Email and password are required for login.");

        const processCookies = (response: Response) => this.processSetCookieHeaders(response.headers.getSetCookie());
        await this.fetchTrusted(this.loginPageUrl, {
            method: "GET",
            headers: { "User-Agent": DEFAULT_USER_AGENT },
        }, processCookies);

        const response = await this.fetchTrusted(this.authUrl, {
            method: "POST",
            headers: this.buildHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({ email: this.email, password: this.password }),
        }, processCookies);

        if (!response.ok) throw new Error(`Dougs login failed (HTTP ${response.status}).`);

        const data = await response.json() as { accessToken?: string };
        if (data.accessToken) this.token = data.accessToken;
        await this.saveSession();
    }

    get<TRawDTO = any>(path: string, query?: Record<string, any>): Promise<TRawDTO> {
        return this.request<TRawDTO>(buildUrlWithQuery(path, query), { method: "GET" });
    }

    post<TRawDTO = any>(path: string, body: any): Promise<TRawDTO> {
        return this.request<TRawDTO>(path, {
            method: "POST",
            body: JSON.stringify(body),
            headers: { "Content-Type": "application/json" },
        });
    }

    delete<TRawDTO = any>(path: string): Promise<TRawDTO> {
        return this.request<TRawDTO>(path, { method: "DELETE" });
    }

    /**
     * Downloads a Dougs file without allowing credentials to cross an origin
     * boundary. The initial trusted request is made manually; a signed S3/CDN
     * redirect is then fetched with no Dougs headers or cookies.
     */
    async downloadFile(path: string): Promise<{ buffer: Buffer; contentType: string; filename?: string }> {
        let url = this.resolveTrustedUrl(path);
        let redirects = 0;

        while (true) {
            const authenticated = url.origin === this.trustedOrigin;
            const response = await fetch(url, {
                method: 'GET',
                // Do not rely on fetch's implementation-specific redirect header
                // stripping. External downloads intentionally receive no headers.
                headers: authenticated ? this.buildHeaders() : {},
                redirect: 'manual',
            });

            if (response.status >= 300 && response.status < 400) {
                if (redirects >= MAX_DOWNLOAD_REDIRECTS) {
                    throw new Error("Download failed: too many redirects.");
                }
                const location = response.headers.get('location');
                if (!location) throw new Error("Download failed: redirect missing location.");

                let nextUrl: URL;
                try {
                    nextUrl = new URL(location, url);
                } catch {
                    throw new Error("Download failed: invalid redirect URL.");
                }
                if (nextUrl.protocol !== 'https:' || nextUrl.username || nextUrl.password) {
                    throw new Error("Download failed: redirect must use credential-free HTTPS.");
                }
                url = nextUrl;
                redirects += 1;
                continue;
            }

            if (!response.ok) throw new Error(`Download failed (HTTP ${response.status}).`);

            const buffer = Buffer.from(await response.arrayBuffer());
            const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
            const disposition = response.headers.get('content-disposition') ?? '';
            const match = disposition.match(/filename\*?="?([^";]+)"?/i);
            const filename = match ? decodeURIComponent(match[1]) : undefined;
            return { buffer, contentType, filename };
        }
    }
}
