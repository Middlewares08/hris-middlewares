import { useMemo, useState } from 'react';
import { useRoles } from '../../hooks/useRoles';
import Loading from '../../components/Loading';
import { CheckCircle2, Circle, CogIcon, LoaderPinwheel, PackageSearch, Pencil, Plus, Shield, Trash2 } from 'lucide-react';
import CustomLabel from '../../components/CustomLabel';
import CustomModal from '../../components/CustomModal';
import CustomInput from '../../components/CustomInput';
import CustomEmptyPlaceholder from '../../components/CustomEmptyPlaceholder';
import { useModules } from '../../hooks/useModule';
import CustomAccordion from '../../components/CustomAccordion';

const EMPTY_FORM = { name: '', description: '' };

const SCOPES = [
    { key: 'ADMIN', label: 'Admin Console', hint: 'Permissions for the HR/admin dashboard' },
    { key: 'SELF_SERVICE', label: 'Employee Self-Service', hint: 'Permissions for the employee mobile app' },
];

const sameIdSet = (a = [], b = []) => {
    if (a.length !== b.length) return false;
    const setB = new Set(b);
    return a.every((id) => setB.has(id));
};

export default function RolesAndPermission() {
    const {
        roles, isLoading, isCreating, isUpdating, isDeleting, isSyncing, error,
        addRole, editRole, removeRole, syncPermissions,
    } = useRoles();

    const { modules, isLoading: isModuleLoading, error: errorModule } = useModules();

    const [selectedRoleId, setSelectedRoleId] = useState(null);
    const [onOpenModal, setOnOpenModal] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const [formData, setFormData] = useState(EMPTY_FORM);

    // Draft of the selected role's permission ids; `null` = follow the saved set
    const [permissionDraft, setPermissionDraft] = useState(null);
    const [scope, setScope] = useState('ADMIN');

    const scopedModules = useMemo(
        () => (modules || []).filter((m) => (m?.access_type || 'ADMIN') === scope),
        [modules, scope],
    );

    // Always read the selected role straight from the (re)fetched list so the
    // permission baseline stays fresh after a save.
    const selectedRole = useMemo(
        () => roles?.find((r) => r.id === selectedRoleId) || null,
        [roles, selectedRoleId],
    );
    const savedPermissions = useMemo(() => selectedRole?.permission_id || [], [selectedRole]);
    const selectedPermissions = permissionDraft ?? savedPermissions;

    const isDirty =
        !!selectedRole && permissionDraft !== null && !sameIdSet(permissionDraft, savedPermissions);

    if (isLoading) return <Loading />;
    if (error) return <div className="p-6 bg-red-50 text-red-700 rounded-xl">{error}</div>;

    const onSelectRole = (role) => {
        setPermissionDraft(null);
        setSelectedRoleId((prev) => (prev === role?.id ? null : role?.id));
    };

    const handlePermissionToggle = (permissionId) => {
        setPermissionDraft((prev) => {
            const base = prev ?? savedPermissions;
            return base.includes(permissionId)
                ? base.filter((id) => id !== permissionId)
                : [...base, permissionId];
        });
    };

    const openCreateModal = () => {
        setEditingRole(null);
        setFormData(EMPTY_FORM);
        setOnOpenModal(true);
    };

    const openEditModal = (role) => {
        setEditingRole(role);
        setFormData({ name: role?.name || '', description: role?.description || '' });
        setOnOpenModal(true);
    };

    const closeModal = () => {
        setOnOpenModal(false);
        setEditingRole(null);
        setFormData(EMPTY_FORM);
    };

    const handleSubmitRole = async (e) => {
        e.preventDefault();
        const payload = { name: formData.name.trim(), description: formData.description.trim() };
        if (!payload.name) return;

        try {
            if (editingRole) {
                await editRole({ id: editingRole.id, roleData: payload });
            } else {
                await addRole(payload);
            }
            closeModal();
        } catch {
            /* toast surfaced by the hook */
        }
    };

    const handleDeleteRole = async (role) => {
        if (role?.is_deletable === false) return;
        if (!window.confirm(`Delete the "${role?.name}" role? This cannot be undone.`)) return;

        try {
            await removeRole(role.id);
            if (selectedRoleId === role.id) {
                setSelectedRoleId(null);
                setPermissionDraft(null);
            }
        } catch {
            /* toast surfaced by the hook */
        }
    };

    const handleApplyPermissions = async () => {
        if (!selectedRole || !isDirty) return;
        try {
            await syncPermissions({ id: selectedRole.id, permissionIds: selectedPermissions });
            setPermissionDraft(null);
        } catch {
            /* toast surfaced by the hook */
        }
    };

    const resetPermissions = () => setPermissionDraft(null);

    // The Administrator role is locked; the default employee role stays editable.
    const isAdminRole = selectedRole?.is_deletable === false && !selectedRole?.is_default;
    const isSavingRole = isCreating || isUpdating;

    const renderRole = () => (
        <div className="bg-white max-h-screen overflow-y-auto min-h-screen border border-slate-200 p-4 space-y-3">
            {roles?.length === 0 && (
                <CustomEmptyPlaceholder
                    title="No roles yet."
                    description="Create your first role to start assigning permissions."
                    icon={PackageSearch}
                    hasButton={false}
                />
            )}
            {roles?.map((role) => {
                const isCurrent = selectedRole?.id === role?.id;
                return (
                    <div
                        key={role?.id}
                        onClick={() => onSelectRole(role)}
                        className={`p-4 border rounded-xl cursor-pointer transition-all group ${
                            isCurrent
                                ? 'bg-gray-50/70 border-gray-500 shadow-xs ring-1 ring-gray-400/20'
                                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                        }`}
                    >
                        <div className="flex justify-between items-center gap-4">
                            <CustomLabel
                                icon={
                                    <div className={`p-2 rounded-lg ${isCurrent ? 'bg-gray-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                        <Shield className="text-sm" />
                                    </div>
                                }
                                iconClasses='my-auto'
                                variant='h4'
                                children={
                                    <span className="flex items-center gap-1.5">
                                        {role?.name}
                                        {role?.is_default && (
                                            <span className="text-[10px] font-semibold uppercase tracking-wide bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">Default</span>
                                        )}
                                        {role?.is_deletable === false && !role?.is_default && (
                                            <span className="text-[10px] font-semibold uppercase tracking-wide bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">System</span>
                                        )}
                                    </span>
                                }
                                addedClass='font-bold text-slate-700! item-left'
                                descriptionClass='text-xs text-slate-500 font-mono'
                                description={`${role?.permission_count || 0} permission granted`}
                            />
                            <div className="relative w-16 h-6 flex items-center justify-end overflow-hidden shrink-0">
                                <span className="absolute right-0 text-xs bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full transition-all duration-300 ease-in-out transform group-hover:translate-x-12 group-hover:opacity-0">
                                    {role?.user_count} staff
                                </span>
                                <div className="absolute right-0 flex items-center gap-1 opacity-0 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 transform translate-x-12 group-hover:translate-x-0 transition-all duration-300 ease-in-out">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            openEditModal(role);
                                        }}
                                        className="p-1 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-md transition-all active:scale-90 cursor-pointer"
                                        title="Edit Role"
                                    >
                                        <Pencil size={14} />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteRole(role);
                                        }}
                                        disabled={role?.is_deletable === false || isDeleting}
                                        className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-md transition-all active:scale-90 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                        title={role?.is_deletable === false ? 'System role cannot be deleted' : 'Delete Role'}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );

    const renderRoleContent = () => (
        <form onSubmit={handleSubmitRole}>
            <div className="space-y-3 mb-3">
                <CustomInput
                    label="Role name"
                    labelPosition='left'
                    icon={Shield}
                    iconPosition="left"
                    type="text"
                    value={formData?.name}
                    isRequired={true}
                    placeholder="Ex. Admin"
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    inputClassName="tracking-widest placeholder:tracking-normal font-mono"
                />

                <div className="space-y-1">
                    <label className='block text-sm font-medium text-slate-700 w-full text-left'> Description </label>
                    <textarea rows="3" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full border border-gray-300 focus-within:ring-blue-500 rounded-lg p-2 text-sm resize-none" placeholder="Explain the structural allowances for this functional role profile..." />
                </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={closeModal} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 font-medium cursor-pointer">Cancel</button>
                <button type="submit" disabled={isSavingRole || !formData.name.trim()} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-50">
                    {isSavingRole && <LoaderPinwheel size={16} className="animate-spin" />}
                    {editingRole ? 'Save Changes' : 'Create Role'}
                </button>
            </div>
        </form>
    );

    const renderPermissionCard = (permissions) => (
        <div className="p-3 bg-white">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {permissions?.map((perm) => {
                    const isChecked = selectedPermissions?.includes(perm?.id);

                    return (
                        <label
                            onClick={() => selectedRole && !isAdminRole && handlePermissionToggle(perm?.id)}
                            key={perm.id}
                            className={`flex items-start gap-2 p-3 rounded-xl transition-all duration-150 select-none border ${
                                isChecked ? 'border-gray-500 bg-slate-100' : 'border-slate-200'
                            } ${selectedRole && !isAdminRole ? 'cursor-pointer hover:border-slate-300' : 'cursor-not-allowed opacity-70'}`}
                        >
                            {isChecked
                                ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-gray-700" />
                                : <Circle size={16} className="mt-0.5 shrink-0 text-slate-300" />}
                            <div className="capitalize">
                                <CustomLabel
                                    variant='p'
                                    children={perm?.action}
                                    addedClass='font-bold text-slate-700! item-left'
                                    descriptionClass='text-xs text-slate-500 '
                                    description={perm?.description}
                                />
                            </div>
                        </label>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto space-y-6 ">
            <div className="flex justify-between border-b border-slate-100 pb-4">
                <div className="flex gap-2 justify-start">
                    <CustomLabel
                        variant='h2'
                        children='Roles and Permissions'
                        addedClass='font-bold text-slate-700! item-left'
                        descriptionClass='text-sm text-slate-500'
                        description={`Pick a role from the list to see what they're allowed to access and do.`}
                    />
                </div>
                <button
                    onClick={openCreateModal}
                    className="h-10 my-auto flex items-center gap-2 bg-gray-700 hover:bg-gray-800 text-white px-4 rounded-lg text-sm font-semibold cursor-pointer active:scale-95 transition-all"
                >
                    <Plus size={16} />
                    New Role
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start max-h-screen">
                <div className="md:col-span-4 bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden max-h-[75vh]">
                    <div className="p-5 flex justify-between items-center">
                        <CustomLabel
                            icon={<CogIcon color='grey' size={30} />}
                            iconClasses={'my-auto'}
                            variant='h3'
                            children='Roles'
                            addedClass='font-bold text-slate-700! item-left'
                            descriptionClass='text-xs text-slate-500'
                            description={'Manage Roles'}
                        />
                    </div>
                    {renderRole()}
                </div>

                {/* 👉 RIGHT COLUMN: Interactive Matrix Workstation (8 / 12 Width) */}
                <div className="md:col-span-8 max-h-[75vh] bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                    <div>
                        <div className="p-5 bg-slate-50/60 border-b border-slate-200 flex justify-between items-center">
                            <CustomLabel
                                icon={<Shield color='grey' size={30} />}
                                iconClasses={'my-auto'}
                                variant='h3'
                                children={selectedRole?.name || 'Permission list'}
                                addedClass='font-bold text-slate-700! item-left'
                                descriptionClass='text-xs text-slate-500'
                                description={selectedRole?.description || 'Manage Permissions'}
                            />
                            <div className="flex items-center gap-2">
                                {isDirty && (
                                    <button
                                        onClick={resetPermissions}
                                        disabled={isSyncing}
                                        className="text-xs bg-white hover:bg-slate-50 text-slate-500 border border-slate-200 px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                        Reset
                                    </button>
                                )}
                                <button
                                    onClick={handleApplyPermissions}
                                    disabled={!selectedRole || !isDirty || isSyncing || isAdminRole}
                                    className="text-xs bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg font-semibold shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSyncing && <LoaderPinwheel size={13} className="animate-spin" />}
                                    Apply Changes
                                </button>
                            </div>
                        </div>

                        {/* Scope switch — admin console vs employee self-service */}
                        <div className="flex gap-1 px-5 pt-4">
                            {SCOPES.map((s) => (
                                <button
                                    key={s.key}
                                    onClick={() => setScope(s.key)}
                                    title={s.hint}
                                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                                        scope === s.key
                                            ? 'bg-gray-700 text-white'
                                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                    }`}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>

                        {/* Matrix Panel */}
                        <div className="p-6 space-y-4 max-h-[60vh] scrollbar-y-visible overflow-y-auto">
                            {errorModule && (
                                <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm">{errorModule}</div>
                            )}

                            {!selectedRole && (
                                <div className='h-full flex flex-col justify-center'>
                                    <CustomEmptyPlaceholder
                                        title="No role selected."
                                        description="Please select a role to manage its permissions."
                                        icon={PackageSearch}
                                        hasButton={false}
                                    />
                                </div>
                            )}

                            {selectedRole && isModuleLoading && <Loading />}

                            {selectedRole && !isModuleLoading && (
                                <>
                                    {isAdminRole && (
                                        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-xs">
                                            The system administrator role always retains full access and can't be edited.
                                        </div>
                                    )}
                                    {scopedModules.length === 0 && (
                                        <CustomEmptyPlaceholder
                                            title="No modules in this scope."
                                            description="Nothing to configure here yet."
                                            icon={PackageSearch}
                                            hasButton={false}
                                        />
                                    )}
                                    {scopedModules.map((mod) => (
                                        <CustomAccordion
                                            key={mod?.id}
                                            icon={<Shield size={25} />}
                                            title={mod?.name}
                                            description={mod?.description}
                                            badgeText={mod?.access_type}
                                            sideLabel={(mod?.permission?.length || 0) + ' Permissions'}
                                            initialOpen={false}
                                            children={renderPermissionCard(mod?.permission)}
                                        />
                                    ))}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <CustomModal
                isOpen={onOpenModal}
                onClose={closeModal}
                title={<h3 className="text-lg font-bold text-slate-900">{editingRole ? 'Modify System Role' : 'Create New Role'}</h3>}
                size="md"
                showCloseButton
                children={renderRoleContent()}
            />
        </div>
    );
}
