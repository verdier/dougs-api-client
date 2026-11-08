import { Client, actions } from '../src';
import { noRetryMutationErrors, OPERATION_UNVALIDATE_UNVERIFIED_POST } from '../src/mutation-errors';

const token = '2026-11-08T10:00:00.000Z';
const editability = (value: boolean) => ({ isAmountEditable: value, isCategoryEditable: value, isDeletable: value });
const before = () => ({
    id: 701, companyId: 101, type: 'bank', date: '2026-10-02', amount: 10,
    totalAmount: 10, isTotalAmountValid: true, isInbound: false, hasVat: false,
    updatedAt: token, memo: 'original', validated: true, validatedAt: '2026-10-02',
    manuallyLocked: false, lockedByDate: false, isDraft: false, deleted: false, excluded: false,
    needsAttention: false, sourceDocumentAttachments: [{ id: 2 }],
    breakdowns: [{ id: 801, companyId: 101, operationId: 701, categoryId: 20, amount: 10,
        isInbound: false, isCounterpart: false, isFee: false, hasVat: false, associationData: { partnerId: 33 }, ...editability(false) }],
});
const after = () => ({ ...before(), validated: false, validatedAt: null, updatedAt: '2026-11-08T10:00:01.000Z',
    breakdowns: before().breakdowns.map(line => ({ ...line, ...editability(true) })) });
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
const endpoint = (operationMemoTag?: string) => new Client({
    email: 'test@example.invalid', password: 'synthetic', cookies: ['session=synthetic'],
    baseUrl: 'https://app.dougs.fr', operationMemoTag,
}).api.operations({ companyId: 101 });

// Synthetic fixtures only. Route/payload evidence is identified in README;
// these tests never read the session cache or send requests to Dougs.
describe('guarded operation unvalidation', () => {
    const realFetch = global.fetch;
    let fetchMock: jest.Mock;
    beforeEach(() => { fetchMock = jest.fn(); global.fetch = fetchMock as typeof fetch; });
    afterEach(() => { global.fetch = realFetch; });

    test.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid operation ID %p locally', async id => {
        await expect(endpoint().unvalidate(id, { expectedUpdatedAt: token })).rejects.toThrow();
        expect(fetchMock).not.toHaveBeenCalled();
    });
    test.each([undefined, null, {}, { expectedUpdatedAt: '' }, { expectedUpdatedAt: ' ' },
        { expectedUpdatedAt: token, validatedAt: null }, { expectedUpdatedAt: token, memo: 'new' }])(
        'rejects invalid/compound expectation %p locally', async expectation => {
            await expect(endpoint().unvalidate(701, expectation as any)).rejects.toThrow();
            expect(fetchMock).not.toHaveBeenCalled();
        });
    test.each([
        { validated: false, validatedAt: null }, { validated: undefined }, { validated: 'true' },
        { validatedAt: null }, { validatedAt: undefined }, { validatedAt: '' },
        { manuallyLocked: true }, { manuallyLocked: undefined }, { lockedByDate: true }, { lockedByDate: undefined },
        { isDraft: true }, { isDraft: undefined }, { deleted: true }, { deleted: undefined },
        { excluded: true }, { excluded: undefined }, { updatedAt: 'newer' }, { updatedAt: undefined },
        { companyId: 102 }, { id: 702 }, { type: 'miscellaneous' }, { type: 'customerEditableMiscellaneous' },
        { type: undefined }, { type: '' }, { breakdowns: undefined },
        { breakdowns: [{ id: 801 }, { id: 801 }] }, { breakdowns: [{ id: 801, companyId: 102 }] },
        { breakdowns: [{ id: 801, operationId: 702 }] },
    ])('fails closed on stale/uneditable/ambiguous preflight %p without POST', async drift => {
        fetchMock.mockResolvedValueOnce(json({ ...before(), ...drift }));
        await expect(endpoint().unvalidate(701, { expectedUpdatedAt: token })).rejects.toThrow();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    test.each(['invoice:client:single', 'invoice:client:batch', 'invoice:vendor'])(
        'rejects unsupported section-dependent invoice type %s before POST', async type => {
            fetchMock.mockResolvedValueOnce(json({ ...before(), type }));
            await expect(endpoint().unvalidate(701, { expectedUpdatedAt: token })).rejects.toThrow('supported operation');
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(fetchMock.mock.calls[0][1].method).toBe('GET');
        });
    test.each([undefined, 'jarvis'])('sends only validated:false, preserves memo even with tag %p, verifies independently', async tag => {
        const raw = before();
        fetchMock.mockResolvedValueOnce(json(raw)).mockResolvedValueOnce(new Response(null, { status: 204 }))
            .mockResolvedValueOnce(json(after()));
        await expect(endpoint(tag).unvalidate(701, { expectedUpdatedAt: token })).resolves.toMatchObject({
            id: 701, validatedAt: null, memo: 'original', amount: 10,
        });
        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(fetchMock.mock.calls.map(call => call[1]?.method ?? 'GET')).toEqual(['GET', 'POST', 'GET']);
        for (const call of fetchMock.mock.calls) expect(String(call[0])).toBe('https://app.dougs.fr/companies/101/operations/701');
        const post = fetchMock.mock.calls[1][1];
        expect(post.redirect).toBe('manual');
        expect(JSON.parse(post.body)).toEqual({ ...raw, validated: false });
        // validatedAt is not blindly cleared in the request: provider owns it.
        expect(JSON.parse(post.body).validatedAt).toBe(raw.validatedAt);
        expect(raw.validated).toBe(true);
    });
    test.each([
        { validated: true }, { validated: undefined }, { validatedAt: token }, { validatedAt: undefined },
        { updatedAt: undefined }, { id: 702 }, { companyId: 102 },
        { memo: 'original #jarvis' }, { amount: 11 }, { totalAmount: 11 }, { isTotalAmountValid: false },
        { needsAttention: true }, { lockedByDate: true }, { manuallyLocked: undefined }, { isDraft: true },
        { excluded: true }, { deleted: true }, { sourceDocumentAttachments: [] },
        { breakdowns: [] }, { breakdowns: [{ ...before().breakdowns[0], categoryId: 21 }] },
        { breakdowns: [{ ...before().breakdowns[0], associationData: { partnerId: 34 } }] },
    ])('reports static no-retry failure for persisted drift %p', async drift => {
        fetchMock.mockResolvedValueOnce(json(before())).mockResolvedValueOnce(json({}))
            .mockResolvedValueOnce(json({ ...after(), ...drift }));
        await expect(endpoint().unvalidate(701, { expectedUpdatedAt: token })).rejects.toThrow(OPERATION_UNVALIDATE_UNVERIFIED_POST);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });
    test('allows only key order, breakdown order and timestamps to normalize', async () => {
        const raw = before();
        raw.breakdowns.push({ ...raw.breakdowns[0], id: 802 });
        const persisted = { ...raw, validated: false, validatedAt: null, updatedAt: 'later',
            breakdowns: [...raw.breakdowns].reverse().map(line => ({ ...line, ...editability(true), updatedAt: 'later' })) };
        // Nested object keys may differ in insertion order without semantic significance.
        fetchMock.mockResolvedValueOnce(json(raw)).mockResolvedValueOnce(json({}))
            .mockResolvedValueOnce(json({ ...persisted, breakdowns: persisted.breakdowns.map(({ associationData, ...line }) => ({ associationData, ...line })) }));
        await expect(endpoint().unvalidate(701, { expectedUpdatedAt: token })).resolves.toMatchObject({ id: 701 });
    });
    // Sanitized structural reproduction of the private 204517756 before/after
    // capture: bank counterpart remains false; business line's three flags flip.
    const bankSnapshots = () => {
        const business = { ...before().breakdowns[0], amount: 60.07, unitAmount: 60.07, quantity: 1,
            section: 'main', resolvedCategoryId: 20, isVatAmountEditable: false,
            associations: [{ id: 'synthetic', slots: [{ key: 'partner', isAssignable: true }] }] };
        const counterpart = { ...business, id: 800, categoryId: 30, resolvedCategoryId: 30,
            isCounterpart: true, isInbound: true, associationData: {}, associations: [] };
        const raw = { ...before(), amount: 60.07, totalAmount: 60.07, breakdowns: [counterpart, business] };
        const persisted = { ...raw, validated: false, validatedAt: null, updatedAt: 'later',
            breakdowns: [counterpart, { ...business, ...editability(true) }] };
        return { raw, persisted };
    };
    test('verifies the realistic bank descriptor transition without changing the POST payload', async () => {
        const { raw, persisted } = bankSnapshots();
        fetchMock.mockResolvedValueOnce(json(raw)).mockResolvedValueOnce(json({})).mockResolvedValueOnce(json(persisted));
        await expect(endpoint().unvalidate(701, { expectedUpdatedAt: token })).resolves.toMatchObject({ amount: 60.07 });
        expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ ...raw, validated: false });
    });
    test.each(['isAmountEditable', 'isCategoryEditable', 'isDeletable'])('requires exact evidence-based %s booleans before/after', async field => {
        for (const value of [true, undefined, 'false']) {
            const { raw } = bankSnapshots();
            const badRaw = { ...raw, breakdowns: raw.breakdowns.map(line => ({ ...line, [field]: value })) };
            fetchMock.mockReset().mockResolvedValueOnce(json(badRaw));
            await expect(endpoint().unvalidate(701, { expectedUpdatedAt: token })).rejects.toThrow('editability');
            expect(fetchMock).toHaveBeenCalledTimes(1);
        }
        for (const value of [false, undefined, 'true']) {
            const { raw, persisted } = bankSnapshots();
            const badAfter = { ...persisted, breakdowns: [persisted.breakdowns[0], { ...persisted.breakdowns[1], [field]: value }] };
            fetchMock.mockReset().mockResolvedValueOnce(json(raw)).mockResolvedValueOnce(json({})).mockResolvedValueOnce(json(badAfter));
            await expect(endpoint().unvalidate(701, { expectedUpdatedAt: token })).rejects.toThrow(OPERATION_UNVALIDATE_UNVERIFIED_POST);
            expect(fetchMock).toHaveBeenCalledTimes(3);
        }
        const { raw, persisted } = bankSnapshots();
        const badCounterpart = { ...persisted, breakdowns: [{ ...persisted.breakdowns[0], [field]: true }, persisted.breakdowns[1]] };
        fetchMock.mockReset().mockResolvedValueOnce(json(raw)).mockResolvedValueOnce(json({})).mockResolvedValueOnce(json(badCounterpart));
        await expect(endpoint().unvalidate(701, { expectedUpdatedAt: token })).rejects.toThrow(OPERATION_UNVALIDATE_UNVERIFIED_POST);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });
    test.each([
        { isVatAmountEditable: true }, { amount: 60.08 }, { categoryId: 21 },
        { associations: [{ id: 'synthetic', slots: [{ key: 'partner', isAssignable: false }] }] },
        { associationData: { partnerId: 99 } },
    ])('keeps all other line semantics strict alongside expected flag transitions: %p', async drift => {
        const { raw, persisted } = bankSnapshots();
        fetchMock.mockResolvedValueOnce(json(raw)).mockResolvedValueOnce(json({})).mockResolvedValueOnce(json({
            ...persisted, breakdowns: [persisted.breakdowns[0], { ...persisted.breakdowns[1], ...drift }],
        }));
        await expect(endpoint().unvalidate(701, { expectedUpdatedAt: token })).rejects.toThrow(OPERATION_UNVALIDATE_UNVERIFIED_POST);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });
    test.each([false, true])('mileage descriptors must remain false, not follow bank transition %p', async editable => {
        const raw = { ...before(), type: 'kilometricIndemnity' };
        const persisted = { ...after(), type: raw.type, breakdowns: raw.breakdowns.map(line => ({ ...line, ...editability(editable) })) };
        fetchMock.mockResolvedValueOnce(json(raw)).mockResolvedValueOnce(json({})).mockResolvedValueOnce(json(persisted));
        const request = endpoint().unvalidate(701, { expectedUpdatedAt: token });
        if (editable) await expect(request).rejects.toThrow(OPERATION_UNVALIDATE_UNVERIFIED_POST);
        else await expect(request).resolves.toMatchObject({ id: 701 });
    });
    test.each([
        new Error('private upstream'), new Response('private upstream', { status: 503 }),
        new Response('private upstream', { status: 401 }), new Response('', { status: 302, headers: { location: '/login' } }),
    ])('never retries, follows redirects or logs in after failed POST', async failure => {
        fetchMock.mockResolvedValueOnce(json(before()));
        if (failure instanceof Error) fetchMock.mockRejectedValueOnce(failure);
        else fetchMock.mockResolvedValueOnce(failure);
        await expect(endpoint().unvalidate(701, { expectedUpdatedAt: token })).rejects.toThrow(/do not retry/);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    test('verification GET failure is static and registered for safe MCP propagation', async () => {
        fetchMock.mockResolvedValueOnce(json(before())).mockResolvedValueOnce(json({}))
            .mockRejectedValueOnce(new Error('private upstream'));
        await expect(endpoint().unvalidate(701, { expectedUpdatedAt: token })).rejects.toThrow(OPERATION_UNVALIDATE_UNVERIFIED_POST);
        expect(noRetryMutationErrors.has(OPERATION_UNVALIDATE_UNVERIFIED_POST)).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });
    test('shared registry exposes a strict authorization-oriented non-idempotent destructive action', async () => {
        const unvalidate = jest.fn().mockResolvedValue({ id: 701 });
        const operations = jest.fn().mockReturnValue({ unvalidate });
        const input = { companyId: 101, operationId: 701, expectedUpdatedAt: token };
        const action = actions.operations_unvalidate;
        await action.execute({ operations } as any, action.inputSchema.parse(input));
        expect(operations).toHaveBeenCalledWith({ companyId: 101 });
        expect(unvalidate).toHaveBeenCalledWith(701, { expectedUpdatedAt: token });
        for (const extra of [{ validatedAt: null }, { memo: 'new' }, { force: true }, { operationMemoTag: 'override' }]) {
            expect(action.inputSchema.safeParse({ ...input, ...extra }).success).toBe(false);
        }
        expect(action.inputSchema.safeParse({ companyId: 101, operationId: 701 }).success).toBe(false);
        expect(action.safety).toEqual({ readOnly: false, destructive: true, idempotent: false, openWorld: true });
    });
});
