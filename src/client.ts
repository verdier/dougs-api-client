import * as fs from 'node:fs';

export interface ClientConfig {
    email: string;
    password: string;
    baseUrl?: string;
    authUrl?: string; // Optional override for auth URL
    token?: string;
    cookies?: string[];
    sessionPath?: string; // Path to save/load session
}

export class Client {
    private email: string;
    private password: string;
    private baseUrl: string;
    private authUrl: string;
    private token: string | null = null;
    private cookies: string[] = [];
    private sessionPath: string | null = null;

    constructor(config: ClientConfig) {
        this.email = config.email;
        this.password = config.password;
        this.baseUrl = config.baseUrl || "https://app.dougs.fr";
        this.authUrl = config.authUrl || "https://app.dougs.fr/auth/api/login";
        this.token = config.token || null;
        this.cookies = config.cookies || [];
        this.sessionPath = config.sessionPath || null;

        this.loadSession();
    }

    public getAuthState() {
        return {
            token: this.token,
            cookies: this.cookies
        };
    }

    private loadSession() {
        if (this.sessionPath && fs.existsSync(this.sessionPath)) {
            try {
                const session = JSON.parse(fs.readFileSync(this.sessionPath, 'utf8'));
                if (session.cookies) this.cookies = session.cookies;
                if (session.token) this.token = session.token;
            } catch (e) {
                console.warn(`Failed to load session from ${this.sessionPath}`, e);
            }
        }
    }

    private saveSession() {
        if (this.sessionPath) {
            try {
                fs.writeFileSync(this.sessionPath, JSON.stringify(this.getAuthState(), null, 2));
            } catch (e) {
                console.warn(`Failed to save session to ${this.sessionPath}`, e);
            }
        }
    }

    private async request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
        const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;

        const headers: Record<string, string> = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:145.0) Gecko/20100101 Firefox/145.0",
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
            ...(options.headers as Record<string, string> || {})
        };

        /*
         * CRITICAL: Do NOT send Authorization header with Bearer token.
         * The Dougs Web App API relies solely on Cookies (auth_session).
         * Sending Bearer token alongside Cookies results in 403 Forbidden.
         * 
         * if (this.token) {
         *    headers["Authorization"] = `Bearer ${this.token}`;
         * }
         */

        if (this.cookies.length > 0) {
            headers["Cookie"] = this.cookies.join('; ');
        }

        const response = await fetch(url, {
            ...options,
            headers
        });

        if (!response.ok) {
            if (response.status === 401 && !path.includes('/login') && retry) {
                console.log("Unauthorized access (401). Attempting re-login...");
                try {
                    await this.login();
                    // Retry the request once with new cookies
                    return this.request<T>(path, options, false);
                } catch (loginError) {
                    console.error("Auto-login failed:", loginError);
                    // Fallthrough to throw expected error
                }
            }
            throw new Error(`Request failed: ${response.status} ${response.statusText} - ${await response.text()}`);
        }

        return response.json() as Promise<T>;
    }

    async login(): Promise<void> {
        if (!this.email || !this.password) {
            throw new Error("Email and password are required for login.");
        }

        // Visit the login page first to get initial cookies (CSRF etc)
        const initialResponse = await fetch("https://app.dougs.fr/auth/login", {
            method: "GET",
            headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:145.0) Gecko/20100101 Firefox/145.0"
            }
        });

        // Capture cookies
        const initialCookies = initialResponse.headers.getSetCookie();

        for (const c of initialCookies) {
            const simpleCookie = c.split(';')[0];
            this.addCookie(simpleCookie);
        }

        const response = await fetch(this.authUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:145.0) Gecko/20100101 Firefox/145.0",
                "Accept": "application/json",
                ...(this.cookies.length > 0 ? { "Cookie": this.cookies.join('; ') } : {})
            },
            body: JSON.stringify({
                email: this.email,
                password: this.password
            })
        });

        if (!response.ok) {
            throw new Error(`Login failed: ${response.status} ${response.statusText} - ${await response.text()}`);
        }

        // Capture cookies
        const authCookies = response.headers.getSetCookie();

        for (const c of authCookies) {
            const simpleCookie = c.split(';')[0];
            this.addCookie(simpleCookie);
        }

        const data = await response.json() as any;
        if (data.accessToken) {
            this.token = data.accessToken;
        }

        this.saveSession();
    }

    private addCookie(cookieStr: string) {
        const [name] = cookieStr.split('=');
        // Remove existing cookie with same name
        this.cookies = this.cookies.filter(c => !c.startsWith(name + '='));
        this.cookies.push(cookieStr);
    }

    get<T>(path: string, query?: Record<string, any>): Promise<T>;
    get<TMapFn extends (raw: any) => any>(path: string, query: Record<string, any> | undefined, mapFn: TMapFn): Promise<ReturnType<TMapFn>>;
    get(path: string, query?: Record<string, any>, mapFn?: (raw: any) => any): Promise<any> {
        let url = path;
        if (query) {
            const params = new URLSearchParams();
            Object.entries(query).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    params.append(key, String(value));
                }
            });
            const queryString = params.toString();
            if (queryString) {
                url += (url.includes('?') ? '&' : '?') + queryString;
            }
        }
        if (mapFn) {
            return this.request(url, { method: "GET" }).then(mapFn);
        }
        return this.request(url, { method: "GET" });
    }

    post<T>(path: string, body: any): Promise<T>;
    post<TMapFn extends (raw: any) => any>(path: string, body: any, mapFn: TMapFn): Promise<ReturnType<TMapFn>>;
    post(path: string, body: any, mapFn?: (raw: any) => any): Promise<any> {
        if (mapFn) {
            return this.request(path, {
                method: "POST",
                body: JSON.stringify(body),
                headers: { "Content-Type": "application/json" }
            }).then(mapFn);
        }
        return this.request(path, {
            method: "POST",
            body: JSON.stringify(body),
            headers: { "Content-Type": "application/json" }
        });
    }

    delete<T>(path: string): Promise<T> {
        return this.request<T>(path, {
            method: "DELETE"
        });
    }
}
