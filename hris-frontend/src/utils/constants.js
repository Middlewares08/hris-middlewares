import { generateUUID } from "./utils";


export const PERMISSION_ACTIONS = {
    ADD: 'add',
    UPDATE: 'update',
    DELETE: 'delete',
    VIEW: 'view',
    RESTORE: 'restore',
};

export const BLANK = '';

export const RATE_TYPE = [
    {
        id: generateUUID(),
        value: 'hr',
        label: 'Hourly'
    },
    {
        id: generateUUID(),
        value: 'day',
        label: 'Daily'
    }
]

export const GENDER = [
    {
        id: generateUUID(),
        value: 'M',
        label: 'Male'
    },
    {
        id: generateUUID(),
        value: 'F',
        label: 'Female'
    },
    {
        id: generateUUID(),
        value: '',
        label: 'Prefer not to say'
    },
]

export const RELIGIONS = [
    { code: 'RC',  name: 'Roman Catholic' },
    { code: 'ISL', name: 'Islam' },
    { code: 'INC', name: 'Iglesia ni Cristo' },
    { code: 'EVN', name: 'Evangelical Christian' },
    { code: 'PRT', name: 'Other Protestant Denomination' },
    { code: 'IFI', name: 'Iglesia Filipina Independiente (Aglipayan)' },
    { code: 'SDA', name: 'Seventh-day Adventist' },
    { code: 'JHV', name: 'Jehovah\'s Witnesses' },
    { code: 'BUD', name: 'Buddhism' },
    { code: 'IND', name: 'Indigenous / Tribal Religions' },
    { code: 'NON', name: 'None / Agnostic / Atheist' },
    { code: 'OTH', name: 'Other Religious Affiliation' }
].sort((a, b) => a.name.localeCompare(b.name));

export const NATIONALITIES = [
    { code: 'FIL', name: 'Filipino' },
    { code: 'AME', name: 'American' },
    { code: 'CHI', name: 'Chinese' },
    { code: 'IND', name: 'Indian' },
    { code: 'JAP', name: 'Japanese' },
    { code: 'KOR', name: 'Korean' },
    { code: 'CAN', name: 'Canadian' },
    { code: 'AUS', name: 'Australian' },
    { code: 'BRT', name: 'British' },
    { code: 'OTH', name: 'Other Nationality' }
].sort((a, b) => {
    // 🎯 If either option is Filipino, force it to the top slot
    if (a.code === 'FIL') return -1;
    if (b.code === 'FIL') return 1;
    // Otherwise, alphabetize normally
    return a.name.localeCompare(b.name);
});

export const EMPLOYMENT_TYPES = [
    {
        id: generateUUID(),
        value: 'regular',
        label: 'Regular'
    },
    {
        id: generateUUID(),
        value: 'probationary',
        label: 'Probationary'
    },
    {
        id: generateUUID(),
        value: 'contractual',
        label: 'Contractual'
    },
    {
        id: generateUUID(),
        value: 'intern',
        label: 'Intern/OJT'
    },
    {
        id: generateUUID(),
        value: 'project-based,',
        label: 'Project-based,'
    },
].sort((a, b) => a.label.localeCompare(b.label));

// Alphanumeric Tax Codes (ATC) for Expanded Withholding Tax — BIR Form 2307.
// A best-effort shortlist of common codes, NOT the full BIR schedule and NOT
// agency-certified. Mirrors `hris-backend/src/database/constants/atcCodes.js` —
// keep both lists in sync. `rate` is carried on the value so the payment form
// can prefill the tax rate when a code is picked.
export const ATC_CODES = [
    { id: generateUUID(), value: 'WI010', rate: 0.05, label: 'WI010 — Professional fees, individual (non-VAT) · 5%' },
    { id: generateUUID(), value: 'WI011', rate: 0.10, label: 'WI011 — Professional fees, individual (VAT-registered) · 10%' },
    { id: generateUUID(), value: 'WI070', rate: 0.10, label: 'WI070 — Professional fees, non-individual · 10%' },
    { id: generateUUID(), value: 'WI050', rate: 0.10, label: 'WI050 — Talent fees, individual · 10%' },
    { id: generateUUID(), value: 'WC010', rate: 0.05, label: 'WC010 — Rental, real/personal property · 5%' },
    { id: generateUUID(), value: 'WC100', rate: 0.02, label: 'WC100 — General engineering/building contractors · 2%' },
    { id: generateUUID(), value: 'WI640', rate: 0.10, label: 'WI640 — Payments to brokers/agents · 10%' },
    { id: generateUUID(), value: 'WC160', rate: 0.15, label: 'WC160 — Income distribution to beneficiaries · 15%' },
];


export const EDUCATION_LEVELS = [
  { label: 'Elementary', value: 'elementary' },
  { label: 'Secondary / High School', value: 'secondary' },
  { label: 'Vocational', value: 'vocational' },
  { label: 'College', value: 'college' },
  { label: 'Graduate / Post-graduate', value: 'graduate' },
];

export const RELATIONSHIP_OPTIONS = [
  { label: 'Spouse', value: 'spouse' },
  { label: 'Child', value: 'child' },
  { label: 'Parent', value: 'parent' },
  { label: 'Sibling', value: 'sibling' },
  { label: 'Relative', value: 'relative' },
  { label: 'Friend', value: 'friend' },
  { label: 'Other', value: 'other' }
].sort((a, b) => a.label.localeCompare(b.label));

export const DOCUMENT_TYPES = [
    { label: 'Resume', value: 'resume' },
    { label: 'Medical', value: 'medical' },
    { label: 'NBI', value: 'nbi' },
    { label: 'Other document', value: 'other' },

];