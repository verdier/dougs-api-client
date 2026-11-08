import { Client, actions } from '../src';

const token = '2026-10-02T10:00:00.000Z';
const before = () => ({
    id: 701, companyId: 101, type: 'expense', date: '2026-10-02', amount: 10,
    totalAmount: 10, isTotalAmountValid: true, isInbound: false, hasVat: false,
    updatedAt: token, memo: 'original', validated: false, validatedAt: null,
    manuallyLocked: false, lockedByDate: false, isDraft: false, deleted: false, excluded: false,
    sourceDocumentAttachments: [{ id: 2 }],
    breakdowns: [{ id: 801, categoryId: 20, amount: 10, isInbound: false, isCounterpart: false, hasVat: false, associationData: { partnerId: 33 } }],
});
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
const endpoint = (operationMemoTag?: string) => new Client({
    email: 'test@example.invalid', password: 'synthetic', cookies: ['session=synthetic'],
    baseUrl: 'https://app.dougs.fr', operationMemoTag,
}).api.operations({ companyId: 101 });

describe('guarded operation memo replacement', () => {
    const realFetch = global.fetch;
    let fetchMock: jest.Mock;
    beforeEach(() => { fetchMock = jest.fn(); global.fetch = fetchMock as typeof fetch; });
    afterEach(() => { global.fetch = realFetch; });

    test.each([null, undefined, 3, ' ', ' x', '<b>x</b>', '\u0000', 'x'.repeat(2001)])('rejects invalid memo %p before any request', async memo => {
        await expect(endpoint().setMemo(701, memo as string, { expectedUpdatedAt: token })).rejects.toThrow('Invalid operation memo');
        expect(fetchMock).not.toHaveBeenCalled();
    });
    test('rejects unknown expectation fields and invalid IDs before requests', async () => {
        await expect(endpoint().setMemo(701, 'new', { expectedUpdatedAt: token, extra: true } as any)).rejects.toThrow();
        await expect(endpoint().setMemo(-1, 'new', { expectedUpdatedAt: token })).rejects.toThrow();
        expect(fetchMock).not.toHaveBeenCalled();
    });
    test.each([
        { manuallyLocked: true }, { lockedByDate: true }, { validated: true }, { validatedAt: token },
        { isDraft: true }, { deleted: true }, { excluded: true }, { lockedByDate: undefined },
        { updatedAt: 'newer' }, { companyId: 102 }, { id: 702 }, { type: 'miscellaneous' },
        { breakdowns: [{ id: 801 }, { id: 801 }] },
    ])('rejects stale, locked, or ambiguous scope %p without POST', async drift => {
        fetchMock.mockResolvedValueOnce(json({ ...before(), ...drift }));
        await expect(endpoint().setMemo(701, 'new', { expectedUpdatedAt: token })).rejects.toThrow();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    test.each([
        [undefined, 'new', 'new'], ['jarvis', 'new', 'new #jarvis'],
        ['jarvis', 'new #jarvis', 'new #jarvis'], [undefined, '', ''], ['jarvis', '', '#jarvis'],
    ])('writes once and preserves unrelated fields (tag %p, memo %p)', async (tag, memo, expectedMemo) => {
        const raw = before();
        fetchMock.mockResolvedValueOnce(json(raw)).mockResolvedValueOnce(json({ ignored: true }))
            .mockResolvedValueOnce(json({ ...raw, memo: expectedMemo, updatedAt: '2026-10-02T10:00:01.000Z' }));
        await expect(endpoint(tag).setMemo(701, memo!, { expectedUpdatedAt: token })).resolves.toMatchObject({ memo: expectedMemo });
        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(fetchMock.mock.calls.map(call => call[1]?.method ?? 'GET')).toEqual(['GET', 'POST', 'GET']);
        expect(String(fetchMock.mock.calls[1][0])).toBe('https://app.dougs.fr/companies/101/operations/701');
        expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ ...raw, memo: expectedMemo });
    });
    test.each([
        { memo: 'other' }, { amount: 11 }, { totalAmount: 11 }, { isTotalAmountValid: false },
        { sourceDocumentAttachments: [] }, { breakdowns: [{ ...before().breakdowns[0], categoryId: 21 }] },
        { breakdowns: [{ ...before().breakdowns[0], associationData: { partnerId: 34 } }] },
        { validated: true },
    ])('fails closed on persisted semantic drift %p without retry', async drift => {
        fetchMock.mockResolvedValueOnce(json(before())).mockResolvedValueOnce(json({}))
            .mockResolvedValueOnce(json({ ...before(), memo: 'new', ...drift }));
        await expect(endpoint().setMemo(701, 'new', { expectedUpdatedAt: token })).rejects.toThrow('OPERATION_MEMO_UNVERIFIED_POST');
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });
    test.each([new Error('private upstream'), new Response('private upstream', { status: 503 }), new Response('', { status: 401 })])('never retries an ambiguous/rejected POST', async failure => {
        fetchMock.mockResolvedValueOnce(json(before()));
        if (failure instanceof Error) fetchMock.mockRejectedValueOnce(failure);
        else fetchMock.mockResolvedValueOnce(failure);
        await expect(endpoint().setMemo(701, 'new', { expectedUpdatedAt: token })).rejects.toThrow(/do not retry/);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    test('verification GET failure yields a static no-retry error', async () => {
        fetchMock.mockResolvedValueOnce(json(before())).mockResolvedValueOnce(json({})).mockRejectedValueOnce(new Error('private'));
        await expect(endpoint().setMemo(701, 'new', { expectedUpdatedAt: token })).rejects.toThrow('OPERATION_MEMO_UNVERIFIED_POST');
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });
    test('rejects unchanged memo and tag overflow without POST', async () => {
        fetchMock.mockResolvedValueOnce(json(before()));
        await expect(endpoint().setMemo(701, 'original', { expectedUpdatedAt: token })).rejects.toThrow('unchanged');
        await expect(endpoint('jarvis').setMemo(701, 'x'.repeat(2000), { expectedUpdatedAt: token })).rejects.toThrow('maximum length');
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    test('shared registry validates and dispatches the only endpoint seam', async () => {
        const setMemo = jest.fn().mockResolvedValue({ id: 701 });
        const operations = jest.fn().mockReturnValue({ setMemo });
        const input = { companyId: 101, operationId: 701, memo: 'new', expectedUpdatedAt: token };
        await actions.operations_set_memo.execute({ operations } as any, actions.operations_set_memo.inputSchema.parse(input));
        expect(setMemo).toHaveBeenCalledWith(701, 'new', { expectedUpdatedAt: token });
        expect(actions.operations_set_memo.inputSchema.safeParse({ ...input, operationMemoTag: 'other' }).success).toBe(false);
        expect(actions.operations_set_memo.safety).toEqual({ readOnly: false, destructive: true, idempotent: false, openWorld: true });
    });
});
