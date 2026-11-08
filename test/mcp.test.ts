import { Client as McpClient } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { actions, type DougsEndpoints } from "../src";
import { createMcpServer, getPackageVersion, registerActions, toToolAnnotations } from "../src/mcp/server";
import { INVESTMENT_UNVERIFIED_POST } from "../src/mutation-errors";

const EXPECTED_ACTIONS = [
    "accounting_get_fiscal_years",
    "accounting_get_fiscal_year",
    "accounting_get_income_statement",
    "accounting_get_treasury_accounts",
    "accounting_get_company_summary",
    "cars_get_all",
    "categories_get_all",
    "companies_get_one",
    "companies_get_partners",
    "invoices_list_sales",
    "invoices_get_sale",
    "invoices_list_purchases",
    "invoices_get_purchase",
    "invoices_download_purchase_evidence",
    "investments_get_all",
    "investments_get_active_categories",
    "investments_get_one",
    "investments_get_status",
    "investments_create",
    "operations_get_all",
    "operations_get_one",
    "operations_set_memo",
    "operations_add_breakdown_detail",
    "operations_set_breakdown_category",
    "operations_set_breakdown_amount",
    "operations_set_breakdown_is_investment",
    "operations_remove_breakdown_detail",
    "operations_get_available_categories",
    "operations_get_breakdown_association_candidates",
    "operations_download_source_document_attachment",
    "operations_delete",
    "operations_create_kilometric_indemnity",
    "operations_create_expense",
    "operations_create_expense_report",
    "performance_list_series",
    "performance_get_serie_values",
    "performance_get_chiffre_daffaires",
    "performance_get_compte_de_resultat",
    "performance_get_resultat_dexploitation",
    "performance_get_charges_dexploitation",
    "performance_get_flux_de_tresorerie",
    "performance_get_fonds_propres",
    "performance_get_tresorerie",
    "performance_get_repartition_des_charges",
    "performance_get_comptes_dassocies",
    "performance_get_autres_reserves_reports_anouveaux",
    "performance_get_suivi_tva",
    "performance_get_suivi_impots_societes",
    "performance_get_suivi_cfe",
    "performance_get_social_charges",
    "performance_get_tns_social_charges",
    "performance_get_remunerations",
    "performance_get_remunerations_for_accounting_year",
    "performance_get_aging_balance",
    "performance_get_suppliers_charges",
    "prestations_list",
    "prestations_get_document_download_path",
    "users_get_me",
    "vendor_invoices_attach_operation",
] as const;

function mockApi(overrides: Partial<DougsEndpoints> = {}): DougsEndpoints {
    return overrides as DougsEndpoints;
}

async function connectMcp(server: McpServer): Promise<McpClient> {
    const client = new McpClient({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
    return client;
}

describe("declarative action contract", () => {
    test("keeps the exact canonical set of 59 stable action names", () => {
        expect(Object.keys(actions)).toHaveLength(59);
        expect(Object.keys(actions)).toEqual(EXPECTED_ACTIONS);
        expect(Object.values(actions).map(action => action.name)).toEqual(EXPECTED_ACTIONS);
    });

    test("defines complete safety metadata, including both mutations", () => {
        for (const action of Object.values(actions)) {
            expect(action.safety).toEqual({
                readOnly: expect.any(Boolean),
                destructive: expect.any(Boolean),
                idempotent: expect.any(Boolean),
                openWorld: expect.any(Boolean),
            });
        }
        expect(actions.operations_delete.safety).toEqual({
            readOnly: false, destructive: true, idempotent: true, openWorld: true,
        });
        expect(actions.operations_create_kilometric_indemnity.safety).toEqual({
            readOnly: false, destructive: false, idempotent: false, openWorld: true,
        });
        expect(actions.operations_create_expense.safety).toEqual({
            readOnly: false, destructive: false, idempotent: false, openWorld: true,
        });
        for (const action of [
            actions.operations_set_memo,
            actions.operations_set_breakdown_category,
            actions.operations_set_breakdown_amount,
            actions.operations_set_breakdown_is_investment,
        ]) {
            expect(toToolAnnotations(action.safety).destructiveHint).toBe(true);
        }
        expect(actions.investments_create.safety).toEqual({
            readOnly: false, destructive: false, idempotent: false, openWorld: true,
        });
        expect(actions.vendor_invoices_attach_operation.safety).toEqual({
            readOnly: false, destructive: false, idempotent: false, openWorld: true,
        });
        expect(actions.invoices_download_purchase_evidence.safety).toEqual({
            readOnly: true, destructive: false, idempotent: true, openWorld: true,
        });
        expect(actions.operations_download_source_document_attachment.safety).toEqual({
            readOnly: true, destructive: false, idempotent: true, openWorld: true,
        });
    });

    test("validates named operation query fields without generated type introspection", () => {
        const valid = actions.operations_get_all.inputSchema.parse({
            companyId: 42,
            query: { "q-date": "01/2025", "q-amount": ">100", "q-isInbound": true },
        });
        expect(valid).toEqual({
            companyId: 42,
            query: { "q-date": "01/2025", "q-amount": ">100", "q-isInbound": true },
        });
        expect(actions.operations_get_all.inputSchema.safeParse({ query: {} }).success).toBe(false);
        expect(actions.operations_get_all.inputSchema.safeParse({ companyId: "42" }).success).toBe(false);
    });

    test("rejects unknown root and nested input keys", () => {
        expect(actions.operations_delete.inputSchema.safeParse({ companyId: 42, id: 7, extra: true }).success).toBe(false);
        expect(actions.operations_get_all.inputSchema.safeParse({
            companyId: 42,
            query: { limit: 5, extra: true },
        }).success).toBe(false);
        expect(actions.operations_create_kilometric_indemnity.inputSchema.safeParse({
            companyId: 42,
            data: { date: "2025-01-01", distance: 10, extra: true },
        }).success).toBe(false);
        expect(actions.invoices_download_purchase_evidence.inputSchema.safeParse({
            companyId: 42, id: "invoice-uuid", extra: true,
        }).success).toBe(false);
        expect(actions.invoices_download_purchase_evidence.inputSchema.safeParse({
            companyId: 42, id: "00000000-0000-4000-8000-000000000001",
        }).success).toBe(true);
        for (const id of ["../other-resource", "5a7083c0/other-resource", "not-a-uuid"]) {
            expect(actions.invoices_download_purchase_evidence.inputSchema.safeParse({ companyId: 42, id }).success).toBe(false);
        }
        expect(actions.operations_download_source_document_attachment.inputSchema.safeParse({
            companyId: 42, operationId: 7, attachmentId: 9, extra: true,
        }).success).toBe(false);
    });

    test("dispatches parsed inputs directly to endpoint methods", async () => {
        const getAll = jest.fn().mockResolvedValue([{ id: 7 }]);
        const operations = jest.fn().mockReturnValue({ getAll });
        const api = mockApi({ operations } as Partial<DougsEndpoints>);
        const input = actions.operations_get_all.inputSchema.parse({
            companyId: 42,
            query: { limit: 5 },
        });

        await expect(actions.operations_get_all.execute(api, input)).resolves.toEqual([{ id: 7 }]);
        expect(operations).toHaveBeenCalledWith({ companyId: 42 });
        expect(getAll).toHaveBeenCalledWith({ limit: 5 });
    });

    test("dispatches evidence downloads directly to endpoint methods", async () => {
        const downloadPurchaseEvidence = jest.fn().mockResolvedValue({
            kind: "downloaded-file", buffer: Buffer.from("invoice"), contentType: "application/pdf",
        });
        const invoices = jest.fn().mockReturnValue({ downloadPurchaseEvidence });
        const downloadSourceDocumentAttachment = jest.fn().mockResolvedValue({
            kind: "downloaded-file", buffer: Buffer.from("attachment"), contentType: "application/pdf",
        });
        const operations = jest.fn().mockReturnValue({ downloadSourceDocumentAttachment });
        const api = mockApi({ invoices, operations } as Partial<DougsEndpoints>);

        await actions.invoices_download_purchase_evidence.execute(api, {
            companyId: 42, id: "00000000-0000-4000-8000-000000000001",
        });
        await actions.operations_download_source_document_attachment.execute(api, {
            companyId: 42, operationId: 7, attachmentId: 9,
        });

        expect(invoices).toHaveBeenCalledWith({ companyId: 42 });
        expect(downloadPurchaseEvidence).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000001");
        expect(operations).toHaveBeenCalledWith({ companyId: 42 });
        expect(downloadSourceDocumentAttachment).toHaveBeenCalledWith(7, 9);
    });
});

describe("MCP adapter", () => {
    test("registers every action with its Zod schema and mapped annotations", () => {
        const server = new McpServer({ name: "test", version: "1.0.0" });
        registerActions(server, mockApi());
        const registered = (server as any)._registeredTools as Record<string, any>;

        expect(Object.keys(registered)).toEqual(EXPECTED_ACTIONS);
        for (const name of EXPECTED_ACTIONS) {
            expect(registered[name].inputSchema).toBe(actions[name].inputSchema);
            expect(registered[name].annotations).toEqual(toToolAnnotations(actions[name].safety));
        }
    });

    test("returns JSON text on success and MCP errors on endpoint failure", async () => {
        const getMe = jest.fn()
            .mockResolvedValueOnce({ id: 1, email: "user@example.test", companies: [] })
            .mockRejectedValueOnce(new Error("endpoint failed"));
        const server = new McpServer({ name: "test", version: "1.0.0" });
        registerActions(server, mockApi({ users: { getMe } }));
        const handler = (server as any)._registeredTools.users_get_me.handler;

        await expect(handler({})).resolves.toEqual({
            content: [{ type: "text", text: JSON.stringify({ id: 1, email: "user@example.test", companies: [] }, null, 2) }],
        });
        await expect(handler({})).resolves.toEqual({
            content: [{ type: "text", text: "Error: Request could not be completed. Check the tool input and Dougs session, then retry." }],
            isError: true,
        });
    });

    test("preserves a local static no-retry mutation error instead of recommending retry", async () => {
        const getMe = jest.fn().mockRejectedValue(new Error(INVESTMENT_UNVERIFIED_POST));
        const server = new McpServer({ name: "test", version: "1.0.0" });
        registerActions(server, mockApi({ users: { getMe } }));
        const handler = (server as any)._registeredTools.users_get_me.handler;

        await expect(handler({})).resolves.toEqual({
            content: [{ type: "text", text: `Error: ${INVESTMENT_UNVERIFIED_POST}` }],
            isError: true,
        });
    });

    test("returns a new evidence-download action as a base64 MCP resource", async () => {
        const downloadPurchaseEvidence = jest.fn().mockResolvedValue({
            kind: "downloaded-file",
            buffer: Buffer.from("PDF"),
            contentType: "Application/PDF; charset=binary",
            filename: "/synthetic\u0000.pdf",
        });
        const invoices = jest.fn().mockReturnValue({ downloadPurchaseEvidence });
        const server = createMcpServer(mockApi({ invoices } as Partial<DougsEndpoints>));
        const client = await connectMcp(server);

        try {
            const result = await client.callTool({
                name: "invoices_download_purchase_evidence",
                arguments: {
                    companyId: 42,
                    id: "00000000-0000-4000-8000-000000000001",
                },
            });

            expect(result).toMatchObject({
                content: [{
                    type: "resource",
                    resource: {
                        uri: "dougs://downloads/_synthetic_.pdf",
                        mimeType: "application/pdf",
                        blob: "UERG",
                    },
                }],
            });
            expect(downloadPurchaseEvidence).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000001");
        } finally {
            await client.close();
            await server.close();
        }
    });

    test.each(["text/html", "image/svg+xml", "not a mime type", "application/x-unknown"])(
        "maps unsafe evidence MIME type %s to application/octet-stream",
        async (contentType) => {
            const downloadPurchaseEvidence = jest.fn().mockResolvedValue({
                kind: "downloaded-file", buffer: Buffer.from("synthetic"), contentType,
            });
            const invoices = jest.fn().mockReturnValue({ downloadPurchaseEvidence });
            const server = new McpServer({ name: "test", version: "1.0.0" });
            registerActions(server, mockApi({ invoices } as Partial<DougsEndpoints>));
            const handler = (server as any)._registeredTools.invoices_download_purchase_evidence.handler;

            const result = await handler({
                companyId: 42,
                id: "00000000-0000-4000-8000-000000000001",
            });

            expect(result.content[0].resource.mimeType).toBe("application/octet-stream");
        },
    );

    test("leaves arbitrary buffer-shaped results as JSON", async () => {
        const getMe = jest.fn().mockResolvedValue({ buffer: Buffer.from("synthetic"), contentType: "application/pdf" });
        const server = new McpServer({ name: "test", version: "1.0.0" });
        registerActions(server, mockApi({ users: { getMe } }));
        const handler = (server as any)._registeredTools.users_get_me.handler;

        const result = await handler({});

        expect(result.content[0].type).toBe("text");
    });

    test("validates direct registered handler input before endpoint dispatch", async () => {
        const getMe = jest.fn().mockResolvedValue({ id: 1 });
        const server = new McpServer({ name: "test", version: "1.0.0" });
        registerActions(server, mockApi({ users: { getMe } }));
        const handler = (server as any)._registeredTools.users_get_me.handler;

        await expect(handler({ unexpected: true })).resolves.toMatchObject({ isError: true });
        expect(getMe).not.toHaveBeenCalled();
    });

    test("rejects unknown tool arguments through MCP before endpoint dispatch", async () => {
        const deleteOperation = jest.fn().mockResolvedValue(undefined);
        const getAll = jest.fn().mockResolvedValue([]);
        const operations = jest.fn().mockReturnValue({ delete: deleteOperation, getAll });
        const server = createMcpServer(mockApi({ operations } as Partial<DougsEndpoints>));
        const client = await connectMcp(server);

        try {
            const deleteResult = await client.callTool({
                name: "operations_delete",
                arguments: { companyId: 42, id: 7, unexpected: true },
            });
            const nestedResult = await client.callTool({
                name: "operations_get_all",
                arguments: { companyId: 42, query: { limit: 5, unexpected: true } },
            });

            expect(deleteResult).toMatchObject({ isError: true });
            expect(nestedResult).toMatchObject({ isError: true });
            expect(deleteOperation).not.toHaveBeenCalled();
            expect(getAll).not.toHaveBeenCalled();
        } finally {
            await client.close();
            await server.close();
        }
    });

    test("derives the server version from package metadata", () => {
        expect(getPackageVersion()).toBe(require("../package.json").version);
    });
});
