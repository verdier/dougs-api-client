#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import dotenv from "dotenv";
import { actions, Client, type ActionDefinition, type ActionSafety, type DougsEndpoints } from "../index";

interface PackageMetadata {
    version?: unknown;
}

export function getPackageVersion(): string {
    const packagePath = join(__dirname, "..", "..", "package.json");
    const metadata = JSON.parse(readFileSync(packagePath, "utf8")) as PackageMetadata;
    if (typeof metadata.version !== "string" || metadata.version.length === 0) {
        throw new Error(`Missing package version in ${packagePath}`);
    }
    return metadata.version;
}

export function toToolAnnotations(safety: ActionSafety): ToolAnnotations {
    return {
        readOnlyHint: safety.readOnly,
        destructiveHint: safety.destructive,
        idempotentHint: safety.idempotent,
        openWorldHint: safety.openWorld,
    };
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return "An unknown error occurred";
}

/** MCP clients must not receive arbitrary upstream response/error text. */
function getSafeToolErrorMessage(): string {
    return "Request could not be completed. Check the tool input and Dougs session, then retry.";
}

export function registerActions(
    server: McpServer,
    api: DougsEndpoints,
    catalog: Record<string, ActionDefinition<any>> = actions,
): void {
    for (const [catalogName, action] of Object.entries(catalog)) {
        if (catalogName !== action.name) {
            throw new Error(`Action catalog key ${catalogName} does not match action name ${action.name}`);
        }

        server.registerTool(
            action.name,
            {
                description: action.description,
                inputSchema: action.inputSchema as any,
                annotations: toToolAnnotations(action.safety),
            },
            async (input: unknown) => {
                try {
                    const parsedInput = action.inputSchema.parse(input);
                    const result = await action.execute(api, parsedInput);
                    return {
                        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) ?? "null" }],
                    };
                } catch (error: unknown) {
                    return {
                        content: [{ type: "text" as const, text: `Error: ${getSafeToolErrorMessage()}` }],
                        isError: true,
                    };
                }
            },
        );
    }
}

export function createMcpServer(api: DougsEndpoints): McpServer {
    const server = new McpServer({
        name: "dougs-mcp-server",
        version: getPackageVersion(),
    });
    registerActions(server, api);
    return server;
}

export async function main(): Promise<void> {
    dotenv.config();
    if (!process.env.DOUGS_EMAIL || !process.env.DOUGS_PASSWORD) {
        console.error("DOUGS_EMAIL and DOUGS_PASSWORD environment variables are required.");
        process.exitCode = 1;
        return;
    }

    // Stdout is reserved for MCP JSON-RPC framing.
    const stderrLogger = {
        log: (message: string, ...args: unknown[]) => console.error(message, ...args),
        warn: (message: string, ...args: unknown[]) => console.error(message, ...args),
        error: (message: string, ...args: unknown[]) => console.error(message, ...args),
    };
    const client = new Client({
        email: process.env.DOUGS_EMAIL,
        password: process.env.DOUGS_PASSWORD,
        logger: stderrLogger,
    });
    const server = createMcpServer(client.api);
    await server.connect(new StdioServerTransport());
}

if (require.main === module) {
    main().catch((error: unknown) => {
        console.error("Fatal error:", getErrorMessage(error));
        process.exitCode = 1;
    });
}
