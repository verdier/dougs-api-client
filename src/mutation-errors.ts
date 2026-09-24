/**
 * Static, safe errors for requests whose provider-side effect is no longer
 * knowable. These strings intentionally contain no upstream response detail.
 */
export const MUTATION_OUTCOME_UNKNOWN =
    "MUTATION_OUTCOME_UNKNOWN: The mutation outcome may have succeeded; do not retry.";

/** A sanitized definite client-error response; it was not replayed. */
export const MUTATION_REJECTED_NO_REPLAY =
    "MUTATION_REJECTED_NO_REPLAY: Dougs rejected the mutation; do not retry.";

export const EXPENSE_REPORT_UNVERIFIED_POST =
    "EXPENSE_REPORT_UNVERIFIED_POST: The expense report may have been created but the POST result could not be verified; do not retry.";

/** @deprecated Use EXPENSE_REPORT_UNVERIFIED_POST. Kept for single-line callers. */
export const EXPENSE_UNVERIFIED_POST = EXPENSE_REPORT_UNVERIFIED_POST;

export const KILOMETRIC_UNVERIFIED_POST =
    "KILOMETRIC_UNVERIFIED_POST: The indemnity may have been created but the POST result could not be verified; do not retry.";

export const INVESTMENT_UNVERIFIED_POST =
    "INVESTMENT_UNVERIFIED_POST: The investment may have been created but the POST result could not be verified; do not retry.";

export const BREAKDOWN_MUTATION_UNVERIFIED_POST =
    "BREAKDOWN_MUTATION_UNVERIFIED_POST: The breakdown mutation may have succeeded but could not be verified; do not retry.";

export const VENDOR_INVOICE_ATTACH_UNVERIFIED_POST =
    "VENDOR_INVOICE_ATTACH_UNVERIFIED_POST: The attachment may have succeeded but its linkage could not be verified; do not retry.";

export const noRetryMutationErrors = new Set<string>([
    MUTATION_OUTCOME_UNKNOWN,
    MUTATION_REJECTED_NO_REPLAY,
    EXPENSE_REPORT_UNVERIFIED_POST,
    KILOMETRIC_UNVERIFIED_POST,
    INVESTMENT_UNVERIFIED_POST,
    BREAKDOWN_MUTATION_UNVERIFIED_POST,
    VENDOR_INVOICE_ATTACH_UNVERIFIED_POST,
]);
