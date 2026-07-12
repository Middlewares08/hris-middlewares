// import { useState } from 'react';
// import { useRoles } from '../../hooks/useRoles';
// import Loading from '../../components/Loading';
// import { LoaderPinwheel, Pencil, Plus, Shield, Trash } from 'lucide-react';
// import CustomLabel from '../../components/CustomLabel';

// export default function RolesAndPermission() {
//     const { 
//         roles, isLoading, isCreating, isUpdating, isDeleting, error, mutationError,
//         addRole, editRole, removeRole 
//     } = useRoles();

//     // Local UI control states
//     const [isModalOpen, setIsModalOpen] = useState(false);
//     const [selectedRole, setSelectedRole] = useState(null); // tracking null = Add Mode, object = Edit Mode
//     const [formData, setFormData] = useState({ name: '', description: '' });

//     // Handle initiating Add Mode
//     const openAddModal = () => {
//         setSelectedRole(null);
//         setFormData({ name: '', description: '' });
//         setIsModalOpen(true);
//     };

//     // Handle initiating Edit Mode
//     const openEditModal = (role) => {
//         setSelectedRole(role);
//         setFormData({ name: role.name, description: role.description || '' });
//         setIsModalOpen(true);
//     };

//     // Unified Submit Action (Dispatches to Add or Edit depending on selectedRole state)
//     const handleSubmit = async (e) => {
//         e.preventDefault();
//         try {
//             if (selectedRole) {
//                 // UPDATE action
//                 await editRole({ id: selectedRole.id, roleData: formData });
//             } else {
//                 // CREATE action
//                 await addRole(formData);
//             }
//             setIsModalOpen(false); // Close layout drawer on success
//         } catch (err) {
//             // Error handling is gracefully wired directly out of TanStack mutation states
//             console.error("Mutation aborted:", err);
//         }
//     };

//     // Delete Trigger Action
//     const handleDelete = async (id) => {
//         if (window.confirm("Are you absolutely sure you want to drop this authorization profile?")) {
//             try {
//                 await removeRole(id);
//             } catch (err) {
//                 alert(err?.response?.data?.error || "Action failed.");
//             }
//         }
//     };

//     if (isLoading) return <Loading/>;
//     if (error) return <div className="p-6 bg-red-50 text-red-700 rounded-xl">{error}</div>;

//     return (
//         <div className="max-w-6xl mx-auto">
//             <div className="flex justify-between ">
//                 <div>
//                     <CustomLabel
//                         variant='h1'
//                         children={'Roles'}
//                         description='Configure core organizational hierarchy and structural permissions mapping.'
//                         addedClass='flex justify-start'
//                     />
//                 </div>
//                 {/* <div>
//                     <h1 className="text-xl font-bold text-slate-900">System Security Clusters</h1>
//                     <p className="text-xs text-slate-500"></p>
//                 </div> */}
//                 <button onClick={openAddModal} className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all">
//                     <Plus className="text-xs" /> Add New Role
//                 </button>
//             </div>

//             {mutationError && <div className="p-4 bg-rose-50 text-rose-700 rounded-lg text-sm font-medium">{mutationError}</div>}

//             {/* Roles Table */}
//             <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
//                 <table className="w-full text-left border-collapse">
//                     <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
//                         <tr className="border-b border-slate-200">
//                             <th className="py-3 px-6">Profile Label</th>
//                             <th className="py-3 px-4">Description Summary</th>
//                             <th className="py-3 px-4 text-center">Active Members</th>
//                             <th className="py-3 px-6 text-right">Actions</th>
//                         </tr>
//                     </thead>
//                     <tbody className="text-sm divide-y divide-slate-100">
//                         {roles.map((role) => (
//                             <tr key={role.id} className="hover:bg-slate-50/40">
//                                 <td className="py-4 px-6 font-semibold text-slate-900 flex items-center gap-2">
//                                     <Shield className="text-slate-400 text-xs" /> {role.name}
//                                 </td>
//                                 <td className="py-4 px-4 text-slate-500 max-w-xs truncate">{role.description || 'No metrics assigned.'}</td>
//                                 <td className="py-4 px-4 text-center font-bold text-slate-700">{role.user_count}</td>
//                                 <td className="py-4 px-6 text-right space-x-2">
//                                     <button onClick={() => openEditModal(role)} className="inline-flex p-2 text-slate-500 hover:text-blue-600 rounded-md hover:bg-blue-50 cursor-pointer">
//                                         <Pencil />
//                                     </button>
//                                     <button onClick={() => handleDelete(role.id)} disabled={isDeleting} className="inline-flex p-2 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 cursor-pointer disabled:opacity-40">
//                                         <Trash />
//                                     </button>
//                                 </td>
//                             </tr>
//                         ))}
//                     </tbody>
//                 </table>
//             </div>

//             {/* Modal Drawer Box (Add / Edit Form) */}
//             {isModalOpen && (
//                 <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50">
//                     <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 w-full max-w-md shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
//                         <h3 className="text-lg font-bold text-slate-900">{selectedRole ? 'Modify System Role' : 'Create New Cluster Profile'}</h3>
                        
//                         <div className="space-y-1">
//                             <label className="text-xs font-semibold text-slate-600 uppercase">Role Identifier Name</label>
//                             <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:outline-gray-600" placeholder="e.g. Finance Administrator" />
//                         </div>

//                         <div className="space-y-1">
//                             <label className="text-xs font-semibold text-slate-600 uppercase">Scope Description</label>
//                             <textarea rows="3" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:outline-gray-600 resize-none" placeholder="Explain the structural allowances for this functional role profile..." />
//                         </div>

//                         <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
//                             <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 font-medium cursor-pointer">Cancel</button>
//                             <button type="submit" disabled={isCreating || isUpdating} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-50">
//                                 {(isCreating || isUpdating) && <LoaderPinwheel className="animate-spin" />}
//                                 Save Target
//                             </button>
//                         </div>
//                     </form>
//                 </div>
//             )}
//         </div>
//     );
// }


import { useState } from 'react';
import { useRoles } from '../../hooks/useRoles';
import Loading from '../../components/Loading';
import { CheckCircle, Cog, CogIcon, Folder, LoaderPinwheel, PackageSearch, PenBox, Pencil, Plus, Shield, Trash, Trash2, User } from 'lucide-react';
import CustomLabel from '../../components/CustomLabel';
import { capitalizeFirstLetter } from '../../utils/utils';
import CustomModal from '../../components/CustomModal';
import CustomInput from '../../components/CustomInput';
import clsx from 'clsx';
import CustomEmptyPlaceholder from '../../components/CustomEmptyPlaceholder';
import { useModules } from '../../hooks/useModule';
import CustomAccordion from '../../components/CustomAccordion';

export default function RolesAndPermission() {
    const { 
        roles, isLoading, isCreating, isUpdating, isDeleting, error, mutationError,
        addRole, editRole, removeRole 
    } = useRoles();

    const { modules, isLoading: isModuleLoading, error: errorModule} = useModules();

    const [selectedRole, setSelectedRole] = useState(null);
    const [onOpenModal, setOnOpenModal] = useState(false);
    const [formData, setFormData] = useState({ name: '', description: '' });

    const [selectedPermissions, setSelectedPermissions] = useState([]); 

    if (isLoading) return <Loading/>;
    if (error) return <div className="p-6 bg-red-50 text-red-700 rounded-xl">{error}</div>;

    const onSelectRole = (role) => {
        if (selectedRole?.id === role?.id) {
            setSelectedRole(null);
            setSelectedPermissions([]);
        } else {
            setSelectedRole(role)
            setSelectedPermissions(role?.permission_id);
        }
    }

    const handlePermissionToggle = (permissionId) => {
        setSelectedPermissions((prev) =>
            prev.includes(permissionId)
                ? prev.filter((id) => id !== permissionId) // Uncheck
                : [...prev, permissionId]                  // Check
        );
    }

    const renderRole = () => (
        <div className="bg-white max-h-screen overflow-y-auto min-h-screen border border-slate-200 p-4 space-y-3">
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
                                children={role?.name}
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
                                            setOnOpenModal(true);
                                        }} 
                                        className="p-1 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-md transition-all active:scale-90 cursor-pointer"
                                        title="Edit Role"
                                    >
                                        <Pencil size={14} />
                                    </button>
                                    <button 
                                        // onClick={(e) => {
                                        //     e.stopPropagation();
                                        //     handleDelete(role.id);
                                        // }} 
                                        className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-md transition-all active:scale-90 cursor-pointer"
                                        title="Delete Role"
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
        <>
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
                <button type="button" onClick={() => setOnOpenModal(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 font-medium cursor-pointer">Cancel</button>
                <button type="submit" disabled={isCreating || isUpdating} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-50">
                    {(isCreating || isUpdating) && <LoaderPinwheel className="animate-spin" />}
                    Save Target
                </button>
            </div>
        </>
    )

    const renderPermissionCard = (permissions) => (
        <div className="p-3 bg-white">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                { permissions?.map((perm) => {
                    const isChecked = selectedPermissions?.includes(perm?.id);

                    return (
                        <label 
                            onClick={() => selectedRole && handlePermissionToggle(perm?.id)}
                            key={perm.id} 
                            className={`flex items-start p-3  rounded-xl cursor-pointer transition-all duration-150 select-none border ${isChecked ? 'border-gray-400 bg-slate-300 text-white!' : 'border-slate-200'}`}
                        >
                            <div className="ml-3 capitalize">
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
    )

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
                    {
                        renderRole()
                    }
                    
                </div>

                {/* 👉 RIGHT COLUMN: Interactive Matrix Workstation Tabs (8 / 12 Width) */}
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
                            <button className="text-xs bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg font-semibold shadow-2xs transition-colors cursor-pointer">
                                Apply Changes
                            </button>
                        </div>
                        
                        {/* Tab Content Panels */}
                        <div className="p-6 space-y-4 max-h-[65vh] scrollbar-y-visible overflow-y-auto">
                            {
                                selectedRole ? 
                                    <>
                                        { modules.map((mod) => (
                                            <>
                                                <CustomAccordion 
                                                    icon={<Shield size={25}/>}
                                                    title={mod?.name}
                                                    description={mod?.description}
                                                    badgeText={mod?.access_type}
                                                    sideLabel={(mod?.permission?.length || 0) + ' Permissions'}
                                                    children={renderPermissionCard(mod?.permission)}
                                                />
                                            </>
                                        ))}
                                    </> :
                                    <div className='h-full flex flex-col justify-center'>
                                        <CustomEmptyPlaceholder
                                            title="No role selected."
                                            description="Please select Role to manage"
                                            icon={PackageSearch}
                                            hasButton={false}
                                        />
                                    </div>
                                    
                            }
                        </div>
                    </div>
                </div>

            </div>
            <CustomModal
                isOpen={onOpenModal} 
                onClose={() => setOnOpenModal(false)} 
                title={<h3 className="text-lg font-bold text-slate-900">{selectedRole ? 'Modify System Role' : 'Create New Cluster Profile'}</h3>}
                size="md"
                showCloseButton
                children={renderRoleContent()}
            />
        </div>
    );
}