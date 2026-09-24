/** Shared runtime guards and limits for curated endpoint paths and accounting values. */

/** Maximum length after trimming an accounting memo. */
export const MAX_ACCOUNTING_MEMO_LENGTH = 2_000;
/** Maximum length after trimming a fixed-asset name. */
export const MAX_INVESTMENT_NAME_LENGTH = 500;
/** A bounded but practical useful life for a fixed asset. */
export const MAX_AMORTIZATION_YEAR_COUNT = 100;
/** A declining-depreciation coefficient must be positive and plausible. */
export const MIN_AMORTIZATION_RATIO = 0.01;
export const MAX_AMORTIZATION_RATIO = 10;
/** Limits for public list/query inputs. */
export const MAX_LIST_LIMIT = 100;
export const MAX_LIST_OFFSET = 10_000;
export const MAX_LIST_PAGE = 10_000;
export const MAX_SEARCH_LENGTH = 200;
/** A hard cap prevents malformed contextual/partner preflight payloads from becoming unbounded work. */
export const MAX_PREFLIGHT_RESULTS = 1_000;
/** A single trip should never need an unbounded distance value. */
export const MAX_KILOMETRIC_DISTANCE = 10_000;

export function isPositiveSafeInteger(value: unknown): value is number {
    return typeof value === 'number'
        && Number.isSafeInteger(value)
        && value > 0;
}

export function assertPositiveSafeInteger(value: unknown): asserts value is number {
    if (!isPositiveSafeInteger(value)) {
        throw new Error("Invalid identifier.");
    }
}

export function isBoundedSafeInteger(value: unknown, minimum: number, maximum: number): value is number {
    return typeof value === 'number'
        && Number.isSafeInteger(value)
        && value >= minimum
        && value <= maximum;
}

export function isUuid(value: unknown): value is string {
    return typeof value === 'string'
        && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function assertUuid(value: unknown): asserts value is string {
    if (!isUuid(value)) throw new Error("Invalid invoice identifier.");
}

export function isIsoDate(value: unknown): value is string {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/**
 * Normalizes an unambiguous provider operation date to the public date-only
 * representation. Datetimes must be the exact bounded UTC form emitted by
 * `Date#toISOString`; offsets and loosely parsed timestamps are rejected.
 */
export function normalizeIsoDateOrUtcDateTime(value: unknown): string | null {
    if (isIsoDate(value)) return value;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
        return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) return null;
    return value.slice(0, 10);
}

/** Monetary amounts are finite euro values with at most two decimal places. */
export function isMoneyAmount(value: unknown, allowZero = false): value is number {
    if (typeof value !== 'number' || !Number.isFinite(value) || (allowZero ? value < 0 : value <= 0)) {
        return false;
    }
    const minorUnits = Math.round(value * 100);
    return Number.isSafeInteger(minorUnits) && Math.abs(value * 100 - minorUnits) < 1e-8;
}

export function toMinorUnits(value: number): number {
    return Math.round(value * 100);
}

/** Plain object guard for untrusted provider payloads and direct endpoint inputs. */
export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Compares valid money values in integer cents to avoid floating-point drift. */
export function sameMoney(left: unknown, right: number, allowZero = false): boolean {
    return isMoneyAmount(left, allowZero) && toMinorUnits(left) === toMinorUnits(right);
}

/** Validates text after applying the same trim semantics as public Zod schemas. */
export function isTrimmedNonBlankText(value: unknown, maxLength: number): value is string {
    return typeof value === 'string'
        && value.trim().length >= 1
        && value.trim().length <= maxLength;
}

/** Turns valid caller text into the canonical representation sent to the provider. */
export function trimText(value: string): string {
    return value.trim();
}

export function isBoundedAmortizationRatio(value: unknown): value is number {
    return typeof value === 'number'
        && Number.isFinite(value)
        && value >= MIN_AMORTIZATION_RATIO
        && value <= MAX_AMORTIZATION_RATIO;
}
