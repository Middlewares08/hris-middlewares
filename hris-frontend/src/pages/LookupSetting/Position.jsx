import { useState, useRef } from "react";

import CustomLabel from "../../components/CustomLabel";
import { CustomDataTable } from '../../components/CustomDataTable';
import { Building2, ShieldAlert, PlusIcon, MemoryStick, Building, Trash, UserCog, PiggyBank } from 'lucide-react';
import { can } from "../../utils/permissionCheck";
import CustomModal from "../../components/CustomModal";
import CustomInput from "../../components/CustomInput";
import CustomButton from "../../components/CustomButton";
import CustomForm from "../../components/CustomForm";
import NotFound from "../../components/NotFound";
import { usePositions } from "../../hooks/usePosition";
import CustomDropdown from "../../components/CustomDropdown";
import { positionValidationSchema } from "../../validation/position-validation";
import { formatDate, handleNumberInput } from "../../utils/utils";
import CustomRadioGroup from "../../components/CustomRadioGroup";
import { BLANK, RATE_TYPE } from "../../utils/constants";

function Position() {
    const {
        positions,
        departments,
        loading,
        error,
        currentPage,
        totalRecords,
        handleSearch,
        handlePageChange,
        handleCreate,
        handleUpdate,
        handleDelete
    } = usePositions();

    const [onOpenModal, setOnOpenModal] = useState(false);
    const [onTrashModal, setOnTrashModal] = useState(false);
    const [payload, setPayload] = useState({
            name: BLANK,
            description: BLANK,
            department: BLANK,
            rate: 0,
            rate_type: BLANK
        })
    
    // 🎯 Reference to manually tap into Formik from outside the form if needed
    const formikRef = useRef(null);

    // 🚀 Trigger Wizard Mode: Create
    const handleOpenCreateModal = () => {
        setOnOpenModal(true);
    };

    // Form Submission Pipeline Handler
    const handleFormSubmit = async () => {
        try {
            if (payload?.uuid) {
                await handleUpdate(payload?.uuid, payload);
            } else {
                await handleCreate(payload);
            }

            setOnOpenModal(false);
        } catch (err) {
            console.error("Form transmission failed:", err);
        } finally {
            setOnOpenModal(false);
        }
    };

    // 📐 Grid Headers Configuration blueprints
    const tableColumns = [
        {
            header: 'Position Name',
            render: (row) => (
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-slate-100 text-slate-700 rounded-lg flex items-center justify-center border border-slate-200 shrink-0">
                        <UserCog size={18} />
                    </div>
                    <div>
                        <div className="font-semibold text-gray-900">{row.name}</div>
                        <div className="text-gray-400 text-xs font-mono select-all">{row.uuid.split('-')[0]}...</div>
                    </div>
                </div>
            )
        },
        {
            header: 'Description',
            render: (row) => (
                <div className="max-w-xs truncate text-gray-500 text-sm">
                    {row.description || <span className="italic text-gray-300">No context summary provided.</span>}
                </div>
            )
        },
        {
            header: 'Department',
            render: (row) => (
                <span className="inline-flex items-center font-mono text-xs font-bold tracking-wider px-2.5 py-1 rounded bg-slate-800 text-slate-100 uppercase">
                    {row?.department?.name}
                </span>
            )
        },
        {
            header: 'Rate',
            render: (row) => (
                <div className="max-w-xs truncate text-gray-500 text-sm">
                    ₱{row?.rate ? Number(row.rate).toFixed(2) : '0.00'} / {row?.rate_type === 'hr' ? 'hr' : 'day'}
                </div>
            )
        },
        {
            header: 'Date Created',
            render: (row) => (
                <div className="max-w-xs truncate text-gray-500 text-sm">
                    {formatDate(row?.created_at, 'dddd, MMMM D, YYYY | h:mm A')}
                </div>
            )
        },
    ];

    const handleOpenEditModal = (pos, closeDrawer, action) => {
        if (closeDrawer) closeDrawer(); // Close the side panel drawer safely
        
        // ✅ Safe Slot: This code now fires strictly on-click
        setPayload({
            name: pos?.name,
            description: pos?.description,
            uuid: pos?.uuid,
            department: pos?.department?.uuid,
            rate: pos?.rate,
            rate_type: pos?.rate_type,
        });

        action === 'upd' ? setOnOpenModal(true) : setOnTrashModal(true)
    };

    const onDelete = async () => {
        // Return early if there is no target id to execute against
        if (!payload?.uuid) return; 

        try {
            // Await the async hook transaction pipeline
            await handleDelete(payload.uuid);

            // 🎯If it succeeds, drop tracking states and close up
            onCloseModal();
        } catch (error) {
            console.error("Archive transaction intercepted:", error.message);
        }
    };

    const onCloseModal = () => {
        setOnOpenModal(false);
        setOnTrashModal(false);
        setPayload({
            name: BLANK,
            description: BLANK,
            department: BLANK,
            rate: 0,
            rate_type: BLANK
        })
    }

    // 🎯 3. Implementation of CustomForm Content Render Function
    const renderModalContent = () => (
        <CustomForm
            formRef={formikRef}
            initialValues={payload}
            validationSchema={positionValidationSchema}
            onSubmit={handleFormSubmit}
            id="position-form"
            content={(errors, touched) => (
                <>
                    <div className="scrollbar-y-visible overflow-y-auto max-h-[50vh] px-2">
                        <CustomInput
                            label="Position"
                            labelPosition='left'
                            icon={Building}
                            iconPosition="left"
                            type="text"
                            maxLength={50}
                            isRequired={true}
                            placeholder="Ex. Engineering"
                            inputClassName="tracking-widest placeholder:tracking-normal font-mono"
                            value={payload?.name}
                            showCharacterCount
                            onChange={(e) =>  setPayload( prevState => ({...prevState, name: e.target.value }))}
                            error={errors.name && touched.name}
                            errorLabel={errors.name}
                        />
                        <div className="mb-4">
                            <CustomDropdown
                                className="items-start! w-full"
                                label="Department"
                                options={departments}
                                value={payload?.department}
                                onChange={(selectedValue) => {
                                    setPayload( prevState => ({...prevState, department: selectedValue}))
                                }}
                                renderProps="name"
                                returnProps="uuid"
                                isRequired={true}
                                disabled={false}
                                error={errors.department && touched.department}
                                errorLabel={errors.department}
                                placeholder="Choose department.."
                            />
                        </div>
                        {/* RATE */}
                        <div className="mb-4">
                            <CustomRadioGroup
                                label="Rate Type"
                                name="rate_type"
                                options={RATE_TYPE}
                                value={payload.rate_type}
                                onChange={(val) => setPayload(prev => ({ ...prev, rate_type: val }))}
                                isRequired={true}
                                className="mb-4"
                            />
                            <CustomInput
                                label="Rate"
                                labelPosition='left'
                                icon={PiggyBank}
                                iconPosition="left"
                                type="text"
                                maxLength={50}
                                isRequired={true}
                                placeholder="1000.00"
                                inputClassName="tracking-widest placeholder:tracking-normal font-mono"
                                value={payload?.rate}
                                onChange={(e) =>  setPayload( prevState => ({...prevState, rate: parseFloat(handleNumberInput(e.target.value)).toFixed(2) }))}
                                error={errors.rate && touched.rate}
                                errorLabel={errors.rate}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className='block text-sm font-medium text-slate-700 w-full text-left'> 
                                Description 
                            </label>
                            <textarea 
                                rows="3" 
                                max={300}
                                value={payload?.description}
                                placeholder="Provide description for this position..." 
                                onChange={(e) =>  setPayload( prevState => ({...prevState, description: e.target.value }))}
                                className={`w-full border rounded-lg p-2 text-sm resize-none outline-none transition-all ${
                                    errors.description && touched.description 
                                        ? 'border-red-400 focus:ring-1 focus:ring-red-400 bg-red-50/10' 
                                        : 'border-gray-300 focus:ring-1 focus:ring-blue-500'
                                }`} 
                            />
                            {errors.description && touched.description && (
                                <p className="text-xs font-semibold text-red-500 text-left">
                                    {errors.description}
                                </p>
                            )}
                        </div>
                    </div>
                </>
            )}
        />
    );

    const renderDeleteModal = () => (
        <>
            <div className="text-center p-2">
                {/* Destructive Warning Badge Centerpiece */}
                <div className="w-14 h-14 bg-red-50 border border-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500 animate-[pulse_2s_infinite]">
                    <ShieldAlert size={28} />
                </div>

                {/* Typography Labels */}
                <h3 className="text-base font-bold text-gray-900 mb-1">
                    Are you absolutely sure?
                </h3>
                <div className="flex justify-center pb-5">
                    <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto mb-6">
                        You are about to archive <span className="font-semibold text-gray-800 font-mono bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded select-all">{payload?.name}</span>.
                    </p>
                </div>

                {/* Unified Button Row Layout Matrix */}
                <div className="flex gap-3 border-t border-slate-100 pt-4 mt-2">
                    <CustomButton
                        children='Cancel'
                        type="button"
                        isLoading={loading}
                        disabled={loading}
                        onClick={() => setOnTrashModal(false)}
                        className="flex-1 py-2.5 border border-gray-200 text-gray-700 bg-white rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors cursor-pointer disabled:opacity-50"
                    />
                    
                    <CustomButton
                        children='Confirm Delete'
                        variant="danger"
                        type="button"
                        isLoading={loading}
                        disabled={loading}
                        onClick={() => onDelete()}
                        icon={Trash}
                        iconPosition="left"
                        className="flex-1 py-2.5 border border-red-200 bg-red-100 hover:bg-red-400 text-red-700 hover:text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-xs"
                    />
                </div>
            </div>
        </>
    )

    const renderDrawerContent = (dept, closeDrawer) => (
        <div className="space-y-6 mt-4">
            <div className="bg-slate-50 border border-gray-100 rounded-xl p-5 text-center">
                <div className="w-12 h-12 bg-slate-700 text-white rounded-xl flex items-center justify-center mx-auto mb-3 shadow-sm"><Building2 size={24} /></div>
                <h4 className="text-lg font-bold text-gray-900">{dept?.name}</h4>
                <span className="inline-block text-xs font-mono font-bold tracking-widest text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded mt-1"> ₱{dept?.rate ? Number(dept?.rate).toFixed(2) : '0.00'} / {dept?.rate_type === 'hr' ? 'hr' : 'day'}</span>
            </div>
            <div className="space-y-4 text-sm">
                <div>
                    <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Description</span>
                    <p className="text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-3 leading-relaxed">{dept?.description || "No description provided."}</p>
                </div>
            </div>
            
            <div className="pt-6 border-t border-gray-100 flex gap-2 space-x-3">
                {can('departments:edit') && (
                    <CustomButton 
                        onClick={() => handleOpenEditModal(dept, closeDrawer, 'upd')}
                        children={'Update Position'}
                        disabled={loading} 
                        isLoading={loading}
                        variant='primary'
                        className='flex-1 py-2 px-4 border border-gray-200 text-blue-700 bg-white rounded-lg text-sm font-semibold hover:bg-blue-50 transition-colors'
                    />

                )}
                {can('departments:delete') && (
                    <CustomButton 
                        onClick={() => handleOpenEditModal(dept, closeDrawer, 'tra')}
                        children={'Move to Trash'}
                        disabled={loading} 
                        isLoading={loading}
                        variant='primary'
                        className='flex-1 py-2 px-4 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-semibold hover:bg-red-100 transition-colors'
                    />
                )}
            </div>
        </div>
    );


    // RETURN 404 IF NO PERMISSION
    if (!can('departments:view')) {
        return <NotFound/>
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between border-b border-slate-100 pb-4">
                <CustomLabel
                    variant='h2' 
                    children='Departments Directory' 
                    addedClass='font-bold text-slate-700!' 
                    descriptionClass='text-sm text-slate-500'
                    description="Manage organizational workspace matrices, operational boundaries, and corporate units."
                />
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-2">
                    <ShieldAlert size={16} /> {error}
                </div>
            )}

            <CustomDataTable
                data={positions}
                columns={tableColumns}
                isLoading={loading}
                searchPlaceholder="Search by position name or description..."
                isServerSide={true}
                totalRecords={totalRecords}
                currentPage={currentPage}
                recordsPerPage={10}
                onPageChange={handlePageChange}
                onSearch={handleSearch}
                actionButton={
                    can('departments:create') && 
                    <CustomButton 
                        children={'Add Position'}
                        onClick={handleOpenCreateModal}
                        icon={PlusIcon}
                        iconPosition='left'
                        type='button'
                        className='flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors shadow-xs'
                    />
                }
                renderDrawerContent={(dept, closeDrawer) => renderDrawerContent(dept, closeDrawer)}
            />

            <CustomModal
                isOpen={onOpenModal} 
                onClose={() => onCloseModal()} 
                title={payload?.uuid ? 'Update Position Details' : 'Create New Position'}
                hasRequiredFields={true}
                size="md"
                showCloseButton
                children={renderModalContent()}
                footer={
                    <div className="flex justify-center! gap-2 pt-4 border-t border-slate-100">
                        <CustomButton 
                            children={payload?.uuid ? 'Update Details' : 'Save Position'}
                            onClick={() => formikRef?.current?.submitForm()}
                            icon={MemoryStick}
                            iconPosition='left'
                            disabled={loading} 
                            isLoading={loading}
                            variant='primary'
                            className='px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-50'
                        />
                    </div>
                }
            />

            <CustomModal
                isOpen={onTrashModal} 
                onClose={() => onCloseModal()} 
                title={'Delete Position?'}
                hasRequiredFields={false}
                size="md"
                children={renderDeleteModal()}
            />
        </div>
    );
}

export default Position;