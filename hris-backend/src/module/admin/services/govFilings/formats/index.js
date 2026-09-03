// src/module/admin/services/govFilings/formats/index.js
//
// Registry: government form key -> its writer + the file formats it can emit.

const sssR3 = require('./sssR3');
const philhealthRF1 = require('./philhealthRF1');
const pagibigMCRF = require('./pagibigMCRF');
const birAlphalist = require('./birAlphalist');
const bir2316 = require('./bir2316');

const REGISTRY = {
    'sss-r3': { writer: sssR3, formats: sssR3.formats, defaultFormat: 'txt', source: 'monthly' },
    'philhealth-rf1': { writer: philhealthRF1, formats: philhealthRF1.formats, defaultFormat: 'csv', source: 'monthly' },
    'pagibig-mcrf': { writer: pagibigMCRF, formats: pagibigMCRF.formats, defaultFormat: 'txt', source: 'monthly' },
    'bir-alphalist': { writer: birAlphalist, formats: birAlphalist.formats, defaultFormat: 'dat', source: 'annual' },
    'bir-2316': { writer: bir2316, formats: bir2316.formats, defaultFormat: 'pdf', source: 'annual' },
};

/**
 * @param {string} formKey
 * @param {object} agg      aggregation output (monthly/annual)
 * @param {object} ctx      { profile }
 * @param {string} [format]
 * @param {object} [opts]   passed through to the writer (e.g. { employeeId })
 * @returns {Promise<{ filename, contentType, body }>}
 */
async function generate(formKey, agg, ctx, format, opts = {}) {
    const entry = REGISTRY[formKey];
    if (!entry) throw Object.assign(new Error(`Unknown government form: ${formKey}`), { status: 400 });

    const fmt = format || entry.defaultFormat;
    if (!entry.formats.includes(fmt)) {
        throw Object.assign(new Error(`${formKey} does not support format "${fmt}". Available: ${entry.formats.join(', ')}`), { status: 400 });
    }

    return entry.writer.generate(agg, ctx, fmt, opts);
}

module.exports = { REGISTRY, generate };
