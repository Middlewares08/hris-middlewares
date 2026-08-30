require('dotenv').config();

// Lazy-loaded so the API boots before `npm i @aws-sdk/client-sts`.
let _sdk = null;
const sdk = () => {
    if (!_sdk) _sdk = require('@aws-sdk/client-sts');
    return _sdk;
};

const REGION = process.env.FACE_REKOGNITION_REGION || process.env.AWS_REGION || 'us-east-1';
const LIVENESS_ROLE_ARN = process.env.FACE_LIVENESS_ROLE_ARN || '';
const CRED_TTL = Math.max(900, parseInt(process.env.FACE_LIVENESS_CRED_TTL, 10) || 900);

let _client = null;
const client = () => {
    if (!_client) {
        const { STSClient } = sdk();
        _client = new STSClient({
            region: REGION,
            credentials:
                process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
                    ? {
                          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                      }
                    : undefined,
        });
    }
    return _client;
};

/**
 * Assume the narrow client role (rekognition:StartFaceLivenessSession only) and
 * return short-lived credentials safe to hand to the browser.
 * @param {string|number} employeeId  used only to label the STS session
 */
async function assumeLivenessRole(employeeId) {
    if (!LIVENESS_ROLE_ARN) {
        const err = new Error('FACE_LIVENESS_ROLE_ARN is not configured.');
        err.code = 'NO_ROLE';
        throw err;
    }
    const { AssumeRoleCommand } = sdk();
    const out = await client().send(
        new AssumeRoleCommand({
            RoleArn: LIVENESS_ROLE_ARN,
            RoleSessionName: `hris-liveness-${String(employeeId || 'anon')}`.slice(0, 64),
            DurationSeconds: CRED_TTL,
        }),
    );
    const c = out.Credentials;
    return {
        accessKeyId: c.AccessKeyId,
        secretAccessKey: c.SecretAccessKey,
        sessionToken: c.SessionToken,
        expiration: c.Expiration,
    };
}

module.exports = { assumeLivenessRole, LIVENESS_ROLE_ARN, LIVENESS_REGION: REGION };
