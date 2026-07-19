import { useState } from 'react';
import { CustomDataTable } from '../../components/CustomDataTable';
import { useEmployees } from '../../hooks/useEmployee';
import { Mail, Phone, MapPin, Trash2, ShieldAlert, PlusIcon, ChevronRight, ChevronLeft, Save } from 'lucide-react';
import CustomLabel from '../../components/CustomLabel';
import { CustomAvatar } from '../../components/CustomAvatar';
import CustomButton from '../../components/CustomButton';
import { can } from '../../utils/permissionCheck';
import CustomModal from '../../components/CustomModal';
import { CustomStepper } from '../../components/CustomStepper';
import { BasicInformation, Benefits, ContactInformation, Employement } from './AddEmployee';
import { BLANK } from '../../utils/constants';
import { basicInfoValidationSchema, employmentValidationSchema } from '../../validation/employee-validation';
import CustomForm from '../../components/CustomForm';
import { useRef } from 'react';

const Employees = () => {
    const basicInfoRef = useRef(null);
    const contactInfoRef = useRef(null);
    const employmentRef = useRef(null);
    const benefitRef = useRef(null);
    const regEmpMainRef = useRef(null);
    const stepRefs = [basicInfoRef, employmentRef, benefitRef, contactInfoRef];

    // Search & Pagination local state variables
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const limit = 10;
    const [onOpenAddModal, setOnOpenAddModal] = useState(false);
    const [payload, setPayload] = useState({
        lastname: BLANK,
        middlename: BLANK,
        firstname: BLANK,
        uploaded_profile: BLANK,
        email: BLANK,
        date_hired: BLANK,
        position: BLANK,
        employment_type: BLANK
    });
    const [currentStep, setCurrentStep] = useState(0);

    // Query hooks mapping to Server-side variables
    const { 
        employees, 
        totalRecords, 
        isLoading, 
        deleteEmployee,
        createEmployee,
        error
    } = useEmployees({ page, limit, search });

    // Handle Delete Trigger Action
    const handleDelete = async (uuid, e) => {
        e.stopPropagation(); // Stop row-click detail drawer expansion
        if (window.confirm("Are you sure you want to delete this employee?")) {
            await deleteEmployee(uuid);
        }
    };

    const handleSubmit = async () => {
        try {
            // Simply pass your form payload
            await createEmployee(payload);
         
            onCloseModal()
        } catch (error) {
            // Errors are already handled by your toast.error in the hook, 
            // but you can catch them here for local component cleanups if needed.
            console.error(error);
        }
    };

    // Columns mapping array passed to CustomDataTable
    const columns = [
        {
            header: 'Full Name',
            render: (row) => (
               <div className="flex items-center gap-3">
                    <CustomAvatar
                        src={row?.profile_url}
                        firstName={row?.first_name}
                        lastName={row?.last_name}
                        size="h-10 w-10 text-sm" // Standard table row avatar sizing
                    />
                    <div className="flex flex-col">
                        <span className="font-semibold text-gray-900">{`${row.first_name} ${row.last_name}`}</span>
                        <span className="text-xs text-gray-400">{row?.credentials?.email}</span>
                    </div>
                </div>
            )
        },
        {
            header: 'Department',
            render: (row) => (
                <span className="inline-flex items-center font-mono text-xs font-bold tracking-wider px-2.5 py-1 rounded bg-slate-800 text-slate-100 uppercase">
                    {row.position?.department?.name || '—'}
                </span>
            )
        },
        {
            header: 'Position',
            render: (row) => ( 
                <>
                <div>
                    <span className="font-mono font-medium text-gray-800">
                        {row?.position?.name}
                    </span>
                </div> 
                <span className='subtitle text-xs'>
                    ₱{row?.position?.rate ? Number(row?.position?.rate).toFixed(2) : '0.00'} / {row.position?.position?.rate_type === 'hr' ? 'hr' : 'day'}
                </span>
                
                </>
                
                
            )
        },
        {
            header: 'Actions',
            className: 'w-20 text-center',
            stopClickPropagation: true, // Prevents detail drawer from sliding open when clicking delete
            render: (row) => (
                <button 
                    onClick={(e) => handleDelete(row.uuid, e)} 
                    className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-lg transition-colors"
                    title="Delete Employee"
                >
                    <Trash2 size={16} />
                </button>
            )
        }
    ];

    const onCloseModal = () => {
        setOnOpenAddModal(false);
        setCurrentStep(0);
        setPayload({
            lastname: BLANK,
            middlename: BLANK,
            firstname: BLANK,
            uploaded_profile: BLANK,
            email: BLANK,
            date_hired: BLANK,
            position: BLANK,
            employment_type: BLANK
        });
    }

    const onOpenAddEmployeeModal = () => {
        setOnOpenAddModal(true);
    }


    const handleNext = () => setCurrentStep((prev) => Math.min(prev + 1, 5 - 1));
    const handlePrev = () => setCurrentStep((prev) => Math.max(prev - 1, 0));
    const updatePayload = (fields) => {
        setPayload((prev) => ({ ...prev, ...fields }));
    };

    const steps = [
        {
            title: 'Personal Info',
            description: "Employee's basic information.",
            content: 
                <CustomForm
                    id="position-form"
                    formRef={basicInfoRef}
                    initialValues={payload}
                    validationSchema={basicInfoValidationSchema}
                    onSubmit={() => handleNext()}
                    content={(errors, touched) =>  
                        <BasicInformation 
                            payload={payload} 
                            onChange={(data) => updatePayload(data)}
                            onNext={handleNext}
                            errors={errors}
                            touched={touched}
                        />
                    }
                />
               
        },
        {
            title: 'Employment',
            description: 'Set up job profile.',
            content: (
                <CustomForm
                    id="employment-form"
                    formRef={employmentRef}
                    initialValues={payload}
                    validationSchema={employmentValidationSchema}
                    onSubmit={() => handleNext()}
                    content={(errors, touched) =>  
                        <Employement 
                            payload={payload} 
                            onChange={(data) => updatePayload(data)}
                            onNext={handleNext}
                            errors={errors}
                            touched={touched}
                        />
                    }
                />
            )
        },
        {
            title: 'Employee Benefits',
            description: 'Tax and state benefit setups',
            content: (
                <CustomForm
                    id="benefit-form"
                    formRef={benefitRef}
                    initialValues={payload}
                    onSubmit={() => handleNext()}
                    content={(errors, touched) =>  
                        <Benefits 
                            payload={payload} 
                            onChange={(data) => updatePayload(data)}
                            onNext={handleNext}
                            errors={errors}
                            touched={touched}
                        />
                    }
                />
            )
        },
        {
            title: 'Contact Info',
            description: 'Workplace and home targets',
            content: (
                <CustomForm
                    id="contact-form"
                    formRef={contactInfoRef}
                    initialValues={payload}
                    onSubmit={() => handleNext()}
                    content={(errors, touched) =>  
                        <ContactInformation 
                            payload={payload} 
                            onChange={(data) => updatePayload(data)}
                            onNext={handleNext}
                            errors={errors}
                            touched={touched}
                        />
                    }
                />
            )
        }
    ];

    // Details Drawer markup panel callback
    const renderEmployeeDrawer = (employee) => {
        return (
            <div className="space-y-6 pt-2 text-left">
                {/* Header Profile Badge */}
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-full flex items-center justify-center font-bold text-xl uppercase">
                        {employee?.first_name[0]}{employee?.last_name[0]}
                    </div>
                    <div>
                        <h4 className="font-bold text-xl text-gray-900">{`${employee?.first_name} ${employee?.last_name}`}</h4>
                        <p className="text-sm text-gray-500">{employee?.position?.name || 'No Position Assigned'}</p>
                    </div>
                </div>

                <hr className="border-gray-100" />

                {/* Information List */}
                <div className="space-y-4">
                    <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Contact & Division</h5>
                    
                    <div className="flex items-center gap-3 text-sm text-gray-700">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <span>{employee?.credentials?.email}</span>
                    </div>
                    
                    <div className="flex items-center gap-3 text-sm text-gray-700">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span>{employee?.phone || 'No phone number'}</span>
                    </div>

                    <div className="flex items-center gap-3 text-sm text-gray-700">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <span>{employee?.department?.name || 'Unassigned Department'}</span>
                    </div>
                </div>

                <hr className="border-gray-100" />

                {/* Compensation Block */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
                    <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Comp & Classification</h5>
                    <div className="flex justify-between items-center pt-1">
                        <span className="text-sm text-slate-600">Base Salary Rate:</span>
                        <span className="font-mono font-bold text-slate-900 text-base">
                          ₱{employee?.position?.rate ? Number(employee?.position?.rate).toFixed(2) : '0.00'} / {employee?.position?.position?.rate_type === 'hr' ? 'hr' : 'day'}
                        </span>
                    </div>
                </div>
            </div>
        );
    };

    

    const renderRegisterEmployeeModal = () => {
       
        return (
            <div className="p-4">
                 <CustomForm
                    id="contact-form"
                    formRef={regEmpMainRef}
                    initialValues={payload}
                    onSubmit={() => handleSubmit()}
                    content={() =>  
                        <CustomStepper 
                            steps={steps} 
                            currentStep={currentStep} 
                            onStepClick={setCurrentStep} // Allows clicking back to completed steps
                        />
                    }
                />
            </div>
        );
    }
    return (
        <div className="max-w-7xl mx-auto space-y-6">
             <div className="flex justify-between border-b border-slate-100 pb-4">
                <CustomLabel
                    variant='h2' 
                    children='Employee Directory' 
                    addedClass='font-bold text-slate-700!' 
                    descriptionClass='text-sm text-slate-500'
                    description="Manage, evaluate, and categorize corporate staff records."
                />
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-2">
                    <ShieldAlert size={16} /> {error}
                </div>
            )}

            {/* Custom Server-Side DataTable */}
            <CustomDataTable
                data={employees}
                columns={columns}
                isLoading={isLoading}
                onSearch={(term) => {
                    setSearch(term);
                    setPage(1); // Reset page selection on search trigger
                }}
                searchPlaceholder="Search by name or email..."
                isServerSide={true}
                totalRecords={totalRecords}
                currentPage={page}
                recordsPerPage={limit}
                onPageChange={(newPage) => setPage(newPage)}
                
                actionButton={
                    can('employee-management:create') && 
                    <CustomButton
                        children={'Register an Employee'}
                        onClick={() => onOpenAddEmployeeModal()}
                        icon={PlusIcon}
                        iconPosition='left'
                        type='button'
                        className='flex items-center gap-2 hover:cursor-pointer px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors shadow-xs'
                    />
                }
                renderDrawerContent={renderEmployeeDrawer}
            />

            <CustomModal
                isOpen={onOpenAddModal} 
                onClose={() => onCloseModal()} 
                title={'Register New Employee'}
                hasRequiredFields={true}
                size="xl"
                showCloseButton
                children={renderRegisterEmployeeModal()}
                footer={<>
                    {
                        currentStep > 0 &&
                        <CustomButton
                            children={'Back'}
                            onClick={() => handlePrev()}
                            icon={ChevronLeft}
                            iconPosition='left'
                            type='button'
                            className='flex items-center gap-2 hover:cursor-pointer px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors shadow-xs'
                        />
                    }
                    {
                        (currentStep < 3) &&
                            <CustomButton
                                children={'Next'}
                                onClick={() => stepRefs[currentStep]?.current?.submitForm()}
                                icon={ChevronRight}
                                iconPosition='right'
                                type='button'
                                className='flex items-center gap-2 hover:cursor-pointer px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors shadow-xs'
                            />
                    }
                    {
                        (currentStep > 2 ) &&
                            <CustomButton
                                children={'Register'}
                                onClick={() => regEmpMainRef?.current?.submitForm()}
                                icon={Save}
                                iconPosition='right'
                                type='button'
                                className='flex items-center gap-2 hover:cursor-pointer px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors shadow-xs'
                            />
                    }
                    
                   
                </>}
            />
        </div>
    );
};

export default Employees;