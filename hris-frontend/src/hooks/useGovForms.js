import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { govFormsService } from '../services/govFormsServices';
import { downloadBlob, filenameFromHeaders } from '../utils/downloadBlob';

const errMsg = (err, fallback) => err?.response?.data?.message || err?.message || fallback;

/** The catalogue of government forms + their available file formats. */
export function useGovFormCatalogue() {
    const query = useQuery({
        queryKey: ['govForms', 'catalogue'],
        queryFn: () => govFormsService.catalogue(),
        select: (res) => res?.data || [],
        staleTime: 60 * 60 * 1000,
    });
    return { forms: query.data || [], isLoading: query.isLoading };
}

/**
 * Preview a form's aggregated rows + control totals + validation warnings.
 * `params` = { form, year, month }. Disabled until `form` + period are set.
 */
export function useGovFormPreview(params) {
    const ready = Boolean(params?.form && params?.year
        && (params.period === 'year' || params.month));

    const query = useQuery({
        queryKey: ['govForms', 'preview', params],
        queryFn: () => govFormsService.preview({
            form: params.form,
            year: params.year,
            ...(params.month ? { month: params.month } : {}),
        }),
        select: (res) => res?.data || null,
        enabled: ready,
        retry: false,
    });

    return {
        data: query.data || null,
        isLoading: query.isFetching,
        error: query.isError ? errMsg(query.error, 'Failed to build the preview.') : null,
        refetch: query.refetch,
    };
}

/**
 * Download a generated artifact. `params` = { form, year, month?, format?, employee_id? }.
 * Returns a promise so callers can show a spinner.
 */
export async function downloadGovForm(params) {
    try {
        const res = await govFormsService.download(params);
        downloadBlob(res.data, filenameFromHeaders(res.headers, `${params.form}.${params.format || 'txt'}`));
        return true;
    } catch (err) {
        // blob error bodies need decoding before we can read `message`
        let msg = 'Failed to generate the file.';
        try {
            const text = await err?.response?.data?.text?.();
            if (text) msg = JSON.parse(text)?.message || msg;
        } catch { /* keep default */ }
        toast.error(msg);
        return false;
    }
}
