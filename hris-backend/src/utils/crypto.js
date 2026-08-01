require('dotenv').config(); 
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
// Retrieve 32-byte key from environment variables
const SECRET_KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex'); 

/**
 * Encrypts plain text (e.g., "21-3232323-2")
 */
function encrypt(text) {
    if (!text) return text;
    const iv = crypto.randomBytes(12); // Initialization vector
    const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    // Return combined payload: IV : AuthTag : EncryptedData
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts encrypted text back to original string
 */
function decrypt(cipherText) {
    if (!cipherText || !cipherText.includes(':')) return cipherText;
    
    const [ivHex, authTagHex, encryptedText] = cipherText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

module.exports = { encrypt, decrypt };