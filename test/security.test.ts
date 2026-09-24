import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "../src";
import { registerActions } from "../src/mcp/server";

const BASE_URL = "https://app.dougs.fr";

function createClient(options: Partial<ConstructorParameters<typeof Client>[0]> = {}): Client {
    return new Client({
        email: "test@example.invalid",
        password: "not-a-real-password",
        baseUrl: BASE_URL,
        cookies: ["session=test-cookie"],
        ...options,
    });
}

describe("authenticated transport boundaries", () => {
    const realFetch = global.fetch;
    let fetchMock: jest.Mock;

    beforeEach(() => {
        fetchMock = jest.fn();
        global.fetch = fetchMock as unknown as typeof fetch;
    });

    afterEach(() => {
        global.fetch = realFetch;
    });

    test("rejects foreign and unsafe public request URLs before fetch", async () => {
        const client = createClient();

        await expect(client.get("https://example.invalid/collect")).rejects.toThrow("configured Dougs HTTPS origin");
        await expect(client.get("http://app.dougs.fr/users/me")).rejects.toThrow("configured Dougs HTTPS origin");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    test("allows a same-origin absolute request URL", async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: 1 }), { status: 200 }));
        const client = createClient();

        await expect(client.get("https://app.dougs.fr/users/me")).resolves.toEqual({ id: 1 });
        expect(String(fetchMock.mock.calls[0][0])).toBe("https://app.dougs.fr/users/me");
    });

    test("follows same-origin authenticated redirects manually", async () => {
        fetchMock
            .mockResolvedValueOnce(new Response(null, {
                status: 307,
                headers: { location: "/users/me/redirected" },
            }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ id: 1 }), { status: 200 }));
        const client = createClient();

        await expect(client.get("/users/me")).resolves.toEqual({ id: 1 });
        expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
            "https://app.dougs.fr/users/me",
            "https://app.dougs.fr/users/me/redirected",
        ]);
        expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
        expect(fetchMock.mock.calls[1][1]).toMatchObject({ redirect: "manual" });
    });

    test.each([301, 302, 303])("rewrites POST to GET and drops body headers on a same-origin %i", async (status) => {
        fetchMock
            .mockResolvedValueOnce(new Response(null, {
                status,
                headers: { location: "/redirected" },
            }))
            .mockResolvedValueOnce(new Response(null, { status: 200 }));
        const client = createClient();
        const body = JSON.stringify({ financial: "payload" });

        await (client as any).fetchTrusted(new URL("https://app.dougs.fr/mutations"), {
            method: "POST",
            body,
            headers: {
                "Content-Type": "application/json",
                "Content-Length": String(body.length),
                "Transfer-Encoding": "chunked",
            },
        });

        const redirectedRequest = fetchMock.mock.calls[1][1] as RequestInit;
        expect(redirectedRequest.method).toBe("GET");
        expect(redirectedRequest.body).toBeUndefined();
        const redirectedHeaders = new Headers(redirectedRequest.headers);
        expect(redirectedHeaders.has("content-type")).toBe(false);
        expect(redirectedHeaders.has("content-length")).toBe(false);
        expect(redirectedHeaders.has("transfer-encoding")).toBe(false);
    });

    test.each([307, 308])("preserves POST method and body on a same-origin %i", async (status) => {
        fetchMock
            .mockResolvedValueOnce(new Response(null, {
                status,
                headers: { location: "/redirected" },
            }))
            .mockResolvedValueOnce(new Response(null, { status: 200 }));
        const client = createClient();
        const body = JSON.stringify({ financial: "payload" });

        await (client as any).fetchTrusted(new URL("https://app.dougs.fr/mutations"), {
            method: "POST",
            body,
            headers: { "Content-Type": "application/json" },
        });

        const redirectedRequest = fetchMock.mock.calls[1][1] as RequestInit;
        expect(redirectedRequest.method).toBe("POST");
        expect(redirectedRequest.body).toBe(body);
        expect(new Headers(redirectedRequest.headers).get("content-type")).toBe("application/json");
    });

    test("uses cookies captured on login and auth redirects for their next trusted hops", async () => {
        fetchMock
            .mockResolvedValueOnce(new Response(null, {
                status: 302,
                headers: {
                    location: "/auth/login/redirected",
                    "set-cookie": "csrf=redirect-cookie; Path=/; Secure",
                },
            }))
            .mockResolvedValueOnce(new Response(null, { status: 200 }))
            .mockResolvedValueOnce(new Response(null, {
                status: 307,
                headers: {
                    location: "/auth/api/login/redirected",
                    "set-cookie": "authenticated=redirect-cookie; Path=/; Secure",
                },
            }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ accessToken: "test-token" }), { status: 200 }));
        const client = createClient();

        await client.login();

        const loginRedirectHeaders = new Headers((fetchMock.mock.calls[1][1] as RequestInit).headers);
        const authHeaders = new Headers((fetchMock.mock.calls[2][1] as RequestInit).headers);
        const authRedirectHeaders = new Headers((fetchMock.mock.calls[3][1] as RequestInit).headers);
        expect(loginRedirectHeaders.get("cookie")).toContain("csrf=redirect-cookie");
        expect(authHeaders.get("cookie")).toContain("csrf=redirect-cookie");
        expect(authRedirectHeaders.get("cookie")).toContain("csrf=redirect-cookie");
        expect(authRedirectHeaders.get("cookie")).toContain("authenticated=redirect-cookie");
    });

    test("refuses a login that Dougs holds for MFA and surfaces it instead of a 401", async () => {
        fetchMock
            .mockResolvedValueOnce(new Response(null, { status: 401 }))
            .mockResolvedValueOnce(new Response(null, { status: 404 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({
                status: "mfaRequired",
                enabledAuthFactors: [{ type: "email" }],
                accessToken: "pre-mfa-token",
            }), { status: 200 }));
        const client = createClient();

        await expect(client.get("/users/me")).rejects.toThrow("Dougs login requires MFA");
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    test("accepts an authenticated login status", async () => {
        fetchMock
            .mockResolvedValueOnce(new Response(null, { status: 404 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ status: "authenticated", accessToken: "t" }), { status: 200 }));

        await expect(createClient().login()).resolves.toBeUndefined();
    });

    test.each([307, 308])("does not follow a foreign %i login redirect", async (status) => {
        fetchMock
            .mockResolvedValueOnce(new Response(null, { status: 200 }))
            .mockResolvedValueOnce(new Response(null, {
                status,
                headers: { location: "https://evil.example.invalid/collect" },
            }));
        const client = createClient({ email: "login@example.invalid", password: "login-secret" });

        await expect(client.login()).rejects.toThrow("configured Dougs HTTPS origin");
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls.map(([url]) => String(url))).not.toContain("https://evil.example.invalid/collect");
        const loginRequest = fetchMock.mock.calls[1][1] as RequestInit;
        expect(loginRequest).toMatchObject({ redirect: "manual" });
        expect(loginRequest.body).toBe(JSON.stringify({ email: "login@example.invalid", password: "login-secret" }));
    });

    test.each([301, 302, 303, 307, 308])("does not follow a foreign %i mutation redirect and never invites a retry", async (status) => {
        fetchMock.mockResolvedValueOnce(new Response(null, {
            status,
            headers: { location: "https://evil.example.invalid/collect" },
        }));
        const client = createClient();

        await expect(client.api.operations({ companyId: 42 }).createKilometricIndemnity({
            date: "2025-01-01", distance: 12, memo: "financial payload",
        })).rejects.toThrow("MUTATION_OUTCOME_UNKNOWN: The mutation outcome may have succeeded; do not retry.");
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(String(fetchMock.mock.calls[0][0])).toBe("https://app.dougs.fr/companies/42/operations");
        const mutationRequest = fetchMock.mock.calls[0][1] as RequestInit;
        expect(mutationRequest).toMatchObject({ method: "POST", redirect: "manual" });
        expect(String(mutationRequest.body)).toContain("financial payload");
    });

    test.each([400, 401, 409])("classifies a definite mutation HTTP %i rejection without replay", async (status) => {
        fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ diagnostic: "private" }), { status }));
        const client = createClient();

        await expect(client.post("/mutations", { synthetic: true }))
            .rejects.toThrow("MUTATION_REJECTED_NO_REPLAY: Dougs rejected the mutation; do not retry.");
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(String(fetchMock.mock.calls[0][0])).toBe("https://app.dougs.fr/mutations");
        expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST", redirect: "manual" });
    });

    test.each([
        ["server error", () => new Response(null, { status: 500 })],
        ["transport failure", () => Promise.reject(new Error("network unavailable"))],
        ["invalid JSON success", () => new Response("not json", { status: 200 })],
    ])("keeps mutation %s as unknown with one POST", async (_name, response) => {
        fetchMock.mockImplementationOnce(response as () => Response | Promise<Response>);
        await expect(createClient().post("/mutations", { synthetic: true }))
            .rejects.toThrow("MUTATION_OUTCOME_UNKNOWN: The mutation outcome may have succeeded; do not retry.");
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test("never redirect-replays a DELETE", async () => {
        fetchMock.mockResolvedValueOnce(new Response(null, { status: 307, headers: { location: "/mutations/redirected" } }));
        const client = createClient();

        await expect(client.delete("/mutations/1"))
            .rejects.toThrow("MUTATION_OUTCOME_UNKNOWN: The mutation outcome may have succeeded; do not retry.");
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "DELETE", redirect: "manual" });
    });

    test("bounds authenticated redirect chains", async () => {
        fetchMock.mockResolvedValue(new Response(null, {
            status: 302,
            headers: { location: "/users/me" },
        }));
        const client = createClient();

        await expect(client.get("/users/me")).rejects.toThrow("too many redirects");
        expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(6);
    });

    test("follows a signed cross-origin download without Dougs headers or cookies", async () => {
        fetchMock
            .mockResolvedValueOnce(new Response(null, {
                status: 302,
                headers: { location: "https://bucket.s3.amazonaws.com/file?signature=redacted" },
            }))
            .mockResolvedValueOnce(new Response("file", {
                status: 200,
                headers: { "content-type": "application/pdf" },
            }));
        const client = createClient();

        const download = await client.downloadFile("/files/123/actions/download");

        expect(download.buffer.toString()).toBe("file");
        expect(String(fetchMock.mock.calls[0][0])).toBe("https://app.dougs.fr/files/123/actions/download");
        const externalOptions = fetchMock.mock.calls[1][1] as RequestInit;
        expect(String(fetchMock.mock.calls[1][0])).toContain("bucket.s3.amazonaws.com");
        expect(externalOptions.headers).toEqual({});
        expect(externalOptions.redirect).toBe("manual");
    });

    test("rejects unsafe download redirects and bounds redirect chains", async () => {
        fetchMock.mockResolvedValueOnce(new Response(null, {
            status: 302,
            headers: { location: "http://bucket.s3.amazonaws.com/file" },
        }));
        const client = createClient();
        await expect(client.downloadFile("/files/123/actions/download")).rejects.toThrow("credential-free HTTPS");
        expect(fetchMock).toHaveBeenCalledTimes(1);

        fetchMock.mockReset();
        fetchMock.mockResolvedValue(new Response(null, {
            status: 302,
            headers: { location: "/files/123/actions/download" },
        }));
        await expect(client.downloadFile("/files/123/actions/download")).rejects.toThrow("too many redirects");
        expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(6);
    });

    test("does not include upstream response bodies in client or MCP errors", async () => {
        const upstreamBody = "upstream-secret-value";
        fetchMock.mockResolvedValue(new Response(upstreamBody, { status: 500 }));
        const client = createClient();

        await expect(client.get("/users/me")).rejects.not.toThrow(upstreamBody);
        await expect(client.get("/users/me")).rejects.toThrow("HTTP 500");

        const server = new McpServer({ name: "test", version: "1.0.0" });
        registerActions(server, client.api);
        const handler = (server as any)._registeredTools.users_get_me.handler;
        const result = await handler({});
        expect(JSON.stringify(result)).not.toContain(upstreamBody);
        expect(result).toMatchObject({ isError: true });
    });
});

describe("session cache permissions", () => {
    test("hardens existing session caches and writes owner-only mode", async () => {
        const directory = await mkdtemp(join(tmpdir(), "dougs-session-"));
        const sessionPath = join(directory, ".session.json");
        try {
            await writeFile(sessionPath, "{}", { mode: 0o644 });
            const client = createClient({ sessionPath });
            expect((await stat(sessionPath)).mode & 0o777).toBe(0o600);

            await (client as any).saveSession();
            expect((await stat(sessionPath)).mode & 0o777).toBe(0o600);
        } finally {
            await rm(directory, { recursive: true, force: true });
        }
    });
});
