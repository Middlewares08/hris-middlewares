/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
    try {
        // 1. Find the default admin role where is_deletable = false
        const adminRole = await knex('role_permission.roles')
            .where({ is_deletable: false }) // Or check if your column is named 'is_deleted' / 'deletable'
            .first();

        if (!adminRole) {
            console.warn('⚠️ No default admin role found (where is_deletable = false). Skipping junction assignment.');
            return;
        }

        // 2. Fetch all permissions available in the system to grant to the admin
        const permissions = await knex('role_permission.permissions')
            .select('id')
            .where({ is_deleted: false });

        if (!permissions || permissions.length === 0) {
            console.warn('⚠️ No permissions found to assign. Make sure to run the permissions seeder first!');
            return;
        }

        // 3. Build the junction table mapping array
        const junctionRows = permissions.map((perm) => {
            return {
                role_id: adminRole.id,
                permission_id: perm.id,
                // include created_by/updated_by tracking if your junction table requires them:
                created_by: 1,
                updated_by: null
            };
        });

        // 4. Insert entries into the junction table safely
        // Assumes your unique constraint on the junction table is a composite key: UNIQUE(role_id, permission_id)
        await knex('role_permission.role_permissions')
                .insert(junctionRows)
                .onConflict(['role_id', 'permission_id']) 
                .ignore(); // If the admin already has this permission, skip it cleanly

        console.log(`💪 Successfully linked all ${junctionRows.length} permissions to the default Admin profile (Role ID: ${adminRole.id})!`);

    } catch (error) {
        console.error('Error seeding role_permissions junction matrix:', error);
    }
};