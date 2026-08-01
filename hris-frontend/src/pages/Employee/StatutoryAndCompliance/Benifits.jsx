import CustomLabel from "../../../components/CustomLabel";
import { CustomDataTable } from '../../../components/CustomDataTable';
import { useEmployeeBenefits } from "../../../hooks/useGovernmentDetail";
import { useRef, useState } from "react";
import { CustomAvatar } from "../../../components/CustomAvatar";
import { can } from "../../../utils/permissionCheck";
import CustomButton from "../../../components/CustomButton";
import CustomModal from "../../../components/CustomModal";
import { MemoryStick } from "lucide-react";
import { Benefits } from "../AddEmployee";
import { BLANK } from "../../../utils/constants";
import { toast } from "sonner";
import CustomForm from "../../../components/CustomForm";
import { benefitValidationSchema } from "../../../validation/benefit-validation";

function Benifits() {
    const formRef = useRef(null);
    const [onUpdateModal, setOnUpdateModal] = useState(false);
    const [payload, setPayload] = useState({
        employee_id: BLANK,
        is_sss_exempt: false,
        sss_number: BLANK,
        is_philhealth_exempt: false,
        philhealth_number: BLANK,
        is_pagibig_exempt: false,
        pagibig_number: BLANK,
        tin_number: BLANK,
    });
    const { 
        employees, 
        loading, 
        currentPage,
        totalRecords,
        // recordsPerPage,
        handleSearch,
        handlePageChange,
        handleUpsert
    } = useEmployeeBenefits();

    const columns = [
            {
                header: 'Full Name',
                render: (row) => (
                   <div className="flex items-center gap-3">
                        <CustomAvatar
                            src={row?.employee?.profile_url}
                            firstName={row?.employee?.first_name}
                            lastName={row?.employee?.last_name}
                            size="h-10 w-10 text-sm" // Standard table row avatar sizing
                        />
                        <div className="flex flex-col">
                            <span className="font-semibold text-gray-900">{`${row?.employee?.first_name} ${row?.employee?.last_name}`}</span>
                            <span className="text-xs text-gray-400">{row?.employee?.credentials?.email}</span>
                        </div>
                    </div>
                )
            },
            {
                header: 'SSS',
                render: (row) => (
                    row?.sss_number ?
                    <span className="inline-flex items-center font-mono text-xs font-bold tracking-wider rounded uppercase">
                        {row?.is_sss_exempt ? 'Exempt' : row?.sss_number}
                    </span> :  <span className="items-center inline-flex font-mono text-slate-400">N/A</span>
                )
            },
            {
                header: 'Pag-Ibig',
                render: (row) => (
                    row?.pagibig_number ?
                    <span className="inline-flex items-center font-mono text-xs font-bold tracking-wider rounded uppercase">
                        {row?.is_pagibig_exempt ? 'Exempt' : row?.pagibig_number}
                    </span> :  <span className="items-center inline-flex font-mono text-slate-400">N/A</span>
                )
            },
            {
                header: 'Philhealth',
                render: (row) => (
                    row?.philhealth_number ?
                    <span className="inline-flex items-center font-mono text-xs font-bold tracking-wider rounded uppercase">
                        {row?.is_philhealth_exempt ? 'Exempt' : row?.philhealth_number }
                    </span> :  <span className="items-center inline-flex font-mono text-slate-400">N/A</span>
                )
            },{
                header: 'TIN',
                render: (row) => (
                    row?.tin_number ? 
                        <span className="inline-flex items-center font-mono text-xs font-bold tracking-wider rounded uppercase">
                            {row?.tin_number}
                        </span> : <span className="items-center text-xs inline-flex font-mono text-slate-400">N/A</span>
                )
            },
    ]

    const updatePayload = (fields) => {
        setPayload((prev) => ({ ...prev, ...fields }));
    };

    const onEditBenfits = (employee) => {
        setPayload({
            employee_id: employee?.employee_id,
            is_sss_exempt: employee?.is_sss_exempt,
            sss_number: employee?.sss_number,
            is_philhealth_exempt: employee?.is_philhealth_exempt,
            philhealth_number: employee?.philhealth_number,
            is_pagibig_exempt: employee?.is_pagibig_exempt,
            pagibig_number: employee?.pagibig_number,
            tin_number: employee?.tin_number,
        });
        setOnUpdateModal(true);
    }

    const onCloseEditModal = () => {
        setOnUpdateModal(false);
    }

    const onHandleUpsert = async () => {
        try {
            await handleUpsert(payload?.employee_id, payload);
            setOnUpdateModal(false);
        } catch (err) {
            setOnUpdateModal(false);
            toast.
            console.error("Form transmission failed:", err);
        } finally {
            setOnUpdateModal(false);
        }
    }

    const renderDrawerContent = (employee, closeDrawer) => {  
    
        return (<>
            <div className="space-y-6 pt-2 text-left">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-full flex items-center justify-center font-bold text-xl uppercase">
                        {employee?.employee?.first_name[0]}{employee?.employee?.last_name[0]}
                    </div>
                    <div>
                        <CustomLabel
                            variant='h4' 
                            children={`${employee?.employee?.first_name} ${employee?.employee?.last_name}`}
                            addedClass='font-bold text-slate-700!' 
                            descriptionClass='text-sm text-slate-500'
                            description={employee?.employee?.position?.name || 'No Position Assigned'}
                        />
                    </div>
                </div>

                <hr className="border-gray-100" />
              
                <div className="text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-5">
                    <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 text-center py-4">Details</span>
                    <hr className="border-gray-200" />
                    <div className="flex justify-between w-full">
                        <CustomLabel
                            children='TIN'
                            addedClass='text-slate-700! text-sm'
                        />
                        <CustomLabel
                            children={employee?.tin_number ? employee?.is_tin_exempt ? 'Exempt' : employee?.tin_number : 'N/A'}
                            addedClass='text-slate-700! font-semibold'
                        />
                    </div>
                    <div className="flex justify-between w-full">
                        <CustomLabel
                            children='SSS'
                            addedClass='text-slate-700! text-sm'
                        />
                        <CustomLabel
                            children={employee?.sss_number ? employee?.is_sss_exempt ? 'Exempt' : employee?.sss_number : 'N/A'}
                            addedClass='text-slate-700! font-semibold'
                        />
                    </div>

                    <div className="flex justify-between w-full">
                        <CustomLabel
                            children='Pag-IBIG Number(MID)'
                            addedClass='text-slate-700! text-sm'
                        />
                        <CustomLabel
                            children={employee?.pagibig_number ? employee?.is_pagibig_exempt ? 'Exempt' : employee?.pagibig_number : 'N/A'}
                            addedClass='text-slate-700! font-semibold'
                        />
                    </div>

                    <div className="flex justify-between w-full">
                        <CustomLabel
                            children='Philhealth Number(PIN)'
                            addedClass='text-slate-700! text-sm'
                        />
                        <CustomLabel
                            children={employee?.philhealth_number ? employee?.is_philhealth_exempt ? 'Exempt' : employee?.philhealth_number : 'N/A'}
                            addedClass='text-slate-700! font-semibold'
                        />
                    </div>

                </div>
            

                <div className="pt-6 border-t border-gray-100 flex gap-2 space-x-3">
                    {can('departments:edit') && (
                        <CustomButton
                            onClick={() => onEditBenfits(employee, closeDrawer, 'upd')}
                            children={'Update Record'}
                            disabled={loading} 
                            isLoading={loading}
                            variant='primary'
                            className='flex-1 py-2 px-4 border border-gray-200 text-blue-700 bg-white rounded-lg text-sm font-semibold hover:bg-blue-50 transition-colors'
                        />
    
                    )}
                </div>
            </div>
        </>
        )
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between border-b border-slate-100 pb-4">
                <CustomLabel
                    variant='h2' 
                    children='Identifications' 
                    addedClass='font-bold text-slate-700!' 
                    descriptionClass='text-sm text-slate-500'
                    description="Manage employee identification records."
                />
            </div>

            <CustomDataTable
                data={employees}
                columns={columns}
                isLoading={loading}
                searchPlaceholder="Search by employee name..."
                isServerSide={true}
                totalRecords={totalRecords}
                currentPage={currentPage}
                recordsPerPage={10}
                onPageChange={handlePageChange}
                onSearch={handleSearch}
                renderDrawerContent={(employee, closeDrawer) => renderDrawerContent(employee, closeDrawer)}
            />


            <CustomModal
                isOpen={onUpdateModal} 
                onClose={() => onCloseEditModal()} 
                title={'Update Employee Details'}
                hasRequiredFields={true}
                size="lg"
                showCloseButton
                children={
                    <CustomForm
                        formRef={formRef}
                        initialValues={payload}
                        validationSchema={benefitValidationSchema}
                        onSubmit={onHandleUpsert}
                        id="position-form"
                        content={(errors, touched) => 
                            <Benefits
                                payload={payload}
                                onChange={(data) => updatePayload(data)}
                                errors={errors}
                                touched={touched}
                                addedClass='border-none'
                            />
                        }
                    />
                }
                footer={
                    <div className="flex justify-center! gap-2 pt-4 border-slate-100">
                        <CustomButton 
                            children='Update Details'
                            onClick={() => formRef?.current?.submitForm()}
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

        </div>
    );
}
export default Benifits;