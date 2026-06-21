const BaseModel = require('../BaseModel');
const bcrypt = require('bcrypt');
const crypto = require('crypto'); // Built into Node.js, no npm install needed

class Credential extends BaseModel {
    static get tableName() { return 'employee.credentials'; }
    // static get schema() { return 'employee'; }
    static get idColumn() { return 'id'; }

    async $beforeInsert(queryContext) {
        super.$beforeInsert(queryContext);
        
        if (queryContext.user) {
            this.created_by = queryContext.user.id;
        }

        // Modern Cryptographically Secure Mixed Alphanumeric Generator
        if (!this.password_hash) {
            // Generates secure random bytes and converts to a base64 alphanumeric string
            const temporaryPassword = crypto
                .randomBytes(9) // 9 bytes turns into a clean 12-character string
                .toString('base64')
                .replace(/[^a-zA-Z0-9]/g, 'X') // Fallback to swap any symbols out for 'X'
                .slice(0, 12); // Hard limit to exactly 12 characters

            console.log(`\n🔑 [SYSTEM AUTO-GEN] Temporary password for ${this.email}: ${temporaryPassword}\n`);
            
            // Assign the temporary password to the field so it gets hashed below
            this.password_hash = temporaryPassword;
        }

        // Hash the password safely before it hits PG
        const saltRounds = 12;
        this.password_hash = await bcrypt.hash(this.password_hash, saltRounds);
    }

    async $beforeUpdate(opt, queryContext) {
        super.$beforeUpdate(opt, queryContext);
        
        if (queryContext.user) {
            this.updated_by = queryContext.user.id;
        }

        if (this.password_hash && opt.old && this.password_hash !== opt.old.password_hash) {
            const saltRounds = 12;
            this.password_hash = await bcrypt.hash(this.password_hash, saltRounds);
        }
    }

    async verifyPassword(plainTextPassword) {
        return bcrypt.compare(plainTextPassword, this.password_hash);
    }
}

module.exports = Credential;