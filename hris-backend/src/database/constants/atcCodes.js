/**
 * Alphanumeric Tax Code (ATC) reference list for Expanded Withholding Tax (EWT) — BIR Form 2307.
 *
 * A best-effort shortlist of the most commonly used codes, NOT the full BIR schedule and NOT
 * agency-certified — same disclaimer as every other government-filing artifact in this codebase
 * (see `module/admin/services/govFilings/README.md`). Confirm each code + rate against the
 * current BIR withholding tax table before relying on it for an actual filing.
 *
 * `payeeType` is informational only (drives the frontend dropdown hint) — it does not gate which
 * codes a payee can be assigned.
 */
const ATC_CODES = [
    { code: 'WI010', description: 'Professional fees — individual (not VAT-registered)', taxRate: 0.05, payeeType: 'individual' },
    { code: 'WI011', description: 'Professional fees — individual (VAT-registered / gross receipts > P3M)', taxRate: 0.10, payeeType: 'individual' },
    { code: 'WI070', description: 'Professional fees — non-individual (corporation/partnership)', taxRate: 0.10, payeeType: 'non_individual' },
    { code: 'WI050', description: 'Talent fees — individual (entertainers, performers, athletes)', taxRate: 0.10, payeeType: 'individual' },
    { code: 'WC010', description: 'Rental — real / personal property', taxRate: 0.05, payeeType: 'both' },
    { code: 'WC100', description: 'General engineering / building contractors', taxRate: 0.02, payeeType: 'non_individual' },
    { code: 'WI640', description: 'Income payments to certain brokers / agents', taxRate: 0.10, payeeType: 'both' },
    { code: 'WC160', description: 'Income distribution to beneficiaries of estates / trusts', taxRate: 0.15, payeeType: 'non_individual' },
];

const atcByCode = (code) => ATC_CODES.find((a) => a.code === String(code || '').toUpperCase()) || null;

module.exports = { ATC_CODES, atcByCode };
