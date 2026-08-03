import { Client } from '../client';

/**
 * Prestation category as returned by Dougs.
 * - `agoa`: Assemblée Générale Ordinaire Annuelle (approbation comptes, dépôt greffe).
 * - `socialManagement`: Gestion sociale courante (bulletins de paie, DSN).
 * - `socialOnboarding`: Onboarding social (création employé, convention collective).
 * - `socialLegal`: Juridique social.
 * - `balanceSheet`: Clôture / bilan annuel.
 * - `customerDelivery`: Livrables divers (signature YouSign, etc.).
 * - `monitoring`: Supervision comptable.
 */
export type PrestationCategory =
    | 'agoa'
    | 'socialManagement'
    | 'socialOnboarding'
    | 'socialLegal'
    | 'balanceSheet'
    | 'customerDelivery'
    | 'monitoring'
    | string;

/**
 * Business code of the prestation (stable identifier of the prestation type).
 * Known values include:
 * - `legal:legalDepositOfAccountAutomated` (dépôt des comptes annuels)
 * - `legal:accountApproval` (PV d'AG approbation des comptes)
 * - `legal:configHeadquarterTransfer`, `legal:headquarterTransfert`
 * - `legal:effectiveBeneficiaries`
 * - `accounting:closing` (clôture), `accounting:revisionPreparation`
 * - `accounting:bankReconciliation`, `accounting:closeBankAccount`
 * - `accounting:monitoring:*`
 * - `social:payslip` (bulletin de paie mensuel)
 * - `social:processDSN`, `social:manualDSNprocessing`
 * - `social:onboarding`, `social:onboarding:allInclusive`
 * - `social:employeeCreated`, `social:nationalConventionAdvice`
 * - `customer:signYousignDocument`
 */
export type PrestationCode = string;

/**
 * Reference to a document attached to a prestation.
 * The file can be downloaded via `/files/<uuid>/actions/download` (returns a 302
 * to a signed S3 URL) when a uuid is present, or via the `url` relative path.
 */
export interface PrestationDocumentDTO {
    /** Document record id in Dougs (may differ from fileId / fileUuid). */
    id?: number;
    /** Internal fileId in Dougs. */
    fileId?: number;
    /** UUID-based download URL, relative to the Dougs API. Use with `downloadFile(url)`. */
    downloadUrl?: string;
    /** File UUID extracted from `downloadUrl` (convenient for downloads). */
    fileUuid?: string;
    /** Human-readable filename. */
    name?: string;
}

/**
 * Billing line item attached to a prestation (when the prestation is billed
 * as a unit of a subscription invoice).
 */
export interface PrestationBillingInvoiceItemDTO {
    id: number;
    billingInvoiceId: number;
    billingInvoiceNumber?: number;
    fullDescription?: string;
    amount?: number;
    quantity?: number;
    totalAmount?: number;
    totalAmountIncludingTaxes?: number;
    isDraft?: boolean;
    paidAt?: string | null;
}

/**
 * One step/milestone inside a prestation workflow.
 */
export interface PrestationStepDTO {
    title?: string;
    completedAt?: string | null;
}

/**
 * Profile of the Dougs team member assigned to the prestation.
 */
export interface PrestationAssigneeDTO {
    fullName?: string;
    email?: string;
    phone?: string | null;
}

/**
 * A "prestation" ("customer delivery" in Dougs terminology) is a unit of
 * work the Dougs team performs for the company: a monthly payslip, an annual
 * account approval (PV d'AG), a balance sheet closing, a VAT declaration, a
 * headquarter transfer, etc.
 */
export interface PrestationDTO {
    /** Dougs-internal id (unique). */
    id: number;
    /** Company the prestation is attached to. */
    companyId: number;
    /** Free-text human title of the prestation (e.g. "Bulletins de paie du mois d'avril"). */
    title?: string;
    /** Stable business code (e.g. `social:payslip`, `legal:accountApproval`). */
    code: PrestationCode;
    /** Broad category (e.g. `agoa`, `socialManagement`, `balanceSheet`). */
    category: PrestationCategory;
    /** Team department in charge (e.g. `legal`, `social`, `accounting`, `customer`). */
    department?: string;
    /** Optional extra description. */
    description?: string | null;
    /** Deadline (ISO date-time). */
    dueDate?: string | null;
    /** Completion timestamp (null if not yet completed). */
    completedAt?: string | null;
    /** Dougs team member currently assigned. */
    assignee?: PrestationAssigneeDTO;
    /** Workflow milestones. */
    steps?: PrestationStepDTO[];
    /** Final deliverable documents (PDFs). */
    finalDocuments: PrestationDocumentDTO[];
    /** Documents provided by the customer. */
    documentProvisions: PrestationDocumentDTO[];
    /** Billing invoice items attached to this prestation. */
    billingInvoiceItems?: PrestationBillingInvoiceItemDTO[];
}

/**
 * Access the company prestations catalogue ("customer deliveries").
 *
 * @mountPath prestations
 * @factory
 * @param {number} companyId - ID of the company to operate on.
 */
export interface PrestationsEndpointParams {
    companyId: number;
}

/**
 * Access the company prestations catalogue ("customer deliveries").
 *
 * A prestation represents a unit of work delivered by the Dougs team
 * (PV d'AG, bulletins de paie, DSN, clôture de bilan, transfert de siège, ...).
 *
 * @mountPath prestations
 * @factory
 * @param {number} companyId - ID of the company to operate on.
 */
export interface PrestationsEndpoint {
    /**
     * List all prestations (customer deliveries) of the company.
     * Includes completed and in-progress prestations, with their final
     * documents, billing invoice items and workflow steps.
     * @returns All prestations attached to the company, newest first.
     */
    list(): Promise<PrestationDTO[]>;

    /**
     * Build the downloadable file URL (relative to the Dougs API base URL)
     * for a prestation document. Typically yields a 302 redirect to a signed
     * AWS S3 URL when followed while authenticated.
     * @param fileUuid - File UUID (obtained from `PrestationDocumentDTO.fileUuid`).
     * @returns The relative download URL.
     */
    getDocumentDownloadPath(fileUuid: string): string;
}

interface RawPrestationDocument {
    id?: number;
    fileId?: number;
    name?: string;
    file?: { url?: string; uuid?: string };
}

interface RawPrestation {
    id: number;
    companyId: number;
    title?: string;
    code: string;
    category: string;
    department?: string;
    description?: string | null;
    dueDate?: string | null;
    completedAt?: string | null;
    assignee?: { profile?: { fullName?: string; email?: string; phone?: string | null } };
    steps?: Array<{ title?: string; completedAt?: string | null }>;
    finalDocuments?: RawPrestationDocument[];
    documentProvisions?: RawPrestationDocument[];
    billingInvoiceItems?: Array<{
        id: number;
        billingInvoiceId: number;
        billingInvoiceNumber?: number;
        fullDescription?: string;
        amount?: number;
        quantity?: number;
        totalAmount?: number;
        totalAmountIncludingTaxes?: number;
        isDraft?: boolean;
        metadata?: { paidAt?: string | null };
    }>;
    [key: string]: unknown;
}

function mapDocument(raw: RawPrestationDocument): PrestationDocumentDTO {
    const url = raw.file?.url;
    // url shape: "/files/<uuid>/actions/download"
    const m = url ? url.match(/\/files\/([0-9a-f-]+)\//i) : null;
    return {
        id: raw.id,
        fileId: raw.fileId,
        downloadUrl: url,
        fileUuid: m ? m[1] : raw.file?.uuid,
        name: raw.name,
    };
}

function mapPrestation(raw: RawPrestation): PrestationDTO {
    return {
        id: raw.id,
        companyId: raw.companyId,
        title: raw.title,
        code: raw.code,
        category: raw.category,
        department: raw.department,
        description: raw.description ?? null,
        dueDate: raw.dueDate ?? null,
        completedAt: raw.completedAt ?? null,
        assignee: raw.assignee?.profile
            ? {
                  fullName: raw.assignee.profile.fullName,
                  email: raw.assignee.profile.email,
                  phone: raw.assignee.profile.phone ?? null,
              }
            : undefined,
        steps: raw.steps?.map(s => ({ title: s.title, completedAt: s.completedAt ?? null })),
        finalDocuments: (raw.finalDocuments ?? []).map(mapDocument),
        documentProvisions: (raw.documentProvisions ?? []).map(mapDocument),
        billingInvoiceItems: raw.billingInvoiceItems?.map(b => ({
            id: b.id,
            billingInvoiceId: b.billingInvoiceId,
            billingInvoiceNumber: b.billingInvoiceNumber,
            fullDescription: b.fullDescription,
            amount: b.amount,
            quantity: b.quantity,
            totalAmount: b.totalAmount,
            totalAmountIncludingTaxes: b.totalAmountIncludingTaxes,
            isDraft: b.isDraft,
            paidAt: b.metadata?.paidAt ?? null,
        })),
    };
}

export const makePrestationsEndpoint = (
    client: Client,
    { companyId }: PrestationsEndpointParams,
): PrestationsEndpoint => {
    return {
        list: () =>
            client
                .get<RawPrestation[]>(`/companies/${companyId}/customer-deliveries`)
                .then(list => list.map(mapPrestation)),

        getDocumentDownloadPath: (fileUuid: string) => `/files/${fileUuid}/actions/download`,
    };
};
