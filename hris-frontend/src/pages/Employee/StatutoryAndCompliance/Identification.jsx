import { useState } from 'react';
import { CustomDataTable } from "../../../components/CustomDataTable";
import CustomLabel from "../../../components/CustomLabel";
import CustomButton from "../../../components/CustomButton"; // Assuming you have CustomButton
import { useEmployeeDocuments } from '../../../hooks/useEmployeeDocument';
import { can } from '../../../utils/permissionCheck';
import { MemoryStick, PlusIcon } from 'lucide-react';
import CustomModal from '../../../components/CustomModal';
import { BLANK, DOCUMENT_TYPES } from '../../../utils/constants';
import CustomForm from '../../../components/CustomForm';
import { useRef } from 'react';
import CustomDropdown from '../../../components/CustomDropdown';
import { CustomFileUploader } from '../../../components/CustomFileUploader';

function Identification() {
    const formRef = useRef(null);
    const [activeEmployee, setActiveEmployee] = useState(null);
    const [documentModal, setDocumentModal] = useState(false);
    const blankPayload = {
        file: [],
        label: BLANK,
        type: BLANK
    };
    const [payload, setPayload] = useState(blankPayload);
    const { 
        documents, 
        loading, 
        handleUpsert, 
        handleDelete,
        handleSearch,  
        currentPage,
        totalRecords,
        handlePageChange
    } = useEmployeeDocuments();

    // Columns configuration for CustomDataTable
    const columns = [
        {
            header: "Employee Name",
            accessor: "name",
            render: (row) => <span className="font-medium text-slate-800">{row.name}</span>
        },
        {
            header: "Department",
            accessor: "department",
            render: (row) => <span>{row.department?.name || 'Unassigned'}</span>
        },
        {
            header: "Actions",
            accessor: "actions",
            render: (row, closeDrawer, openDrawer) => (
                <CustomButton
                    onClick={() => {
                        setActiveEmployee(row);
                        if (openDrawer) openDrawer(row);
                    }}
                    className="text-xs bg-slate-800 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 transition"
                >
                    📁 Manage Documents
                </CustomButton>
            )
        }
    ];

    const onCloseDocumentModal = () => {
        setDocumentModal(false);
        setPayload(blankPayload);
    }

    const onHandleUpsert = async () => {
        try {
            await handleUpsert(payload?.employee_id, payload);
        } catch (err) {
            onCloseDocumentModal();
            console.error("Form transmission failed:", err);
        }

        onCloseDocumentModal()
    }

    const onChangePayload = (field, value) => {
        setPayload((prev) => ({ ...prev, [field]: value}));
    }

    const onRenderDocumentModal = (errors, touched) => {

        return (
            <>
                <div>
                    <CustomDropdown
                        className="items-start! w-full "
                        label="Document Type"
                        isRequired
                        options={DOCUMENT_TYPES}
                        value={payload?.label}
                        onChange={(val) => setPayload((prev) => ({ ...prev, label: val}))}
                        renderProps="label"
                        returnProps="value"
                        placeholder="Select document type"
                        error={errors?.label && touched?.label}
                        errorLabel={errors?.label}
                    />
                    
                    <div className='my-5'>
                        <CustomFileUploader
                            isRequired
                            label='Upload File'
                            maxFiles={1}
                            value={payload?.file} 
                            onChange={(fileData) => {
                                setPayload((prev) => ({ ...prev, file: fileData}))
                            }} 
                            accept="image/*,application/pdf"
                        />
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
                    addedClass='font-bold text-slate-700!' 
                    descriptionClass='text-sm text-slate-500'
                    description="Manage employee identification records."
                >
                    Identifications
                </CustomLabel>
            </div>

            <CustomDataTable
                data={documents}
                columns={columns}
                isLoading={loading}
                searchPlaceholder="Search by employee name..."
                isServerSide={true}
                totalRecords={totalRecords}
                currentPage={currentPage}
                recordsPerPage={10}
                onPageChange={handlePageChange}
                onSearch={handleSearch}
                actionButton={
                    can('employee-management:create') && 
                    <CustomButton
                        children={'Attach New Document'}
                        onClick={() => setDocumentModal(true)}
                        icon={PlusIcon}
                        iconPosition='left'
                        type='button'
                        className='flex items-center gap-2 hover:cursor-pointer px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors shadow-xs'
                    />
                }
                renderDrawerContent={(employee) => (
                    <EmployeeDocumentDrawerContent employee={employee || activeEmployee} />
                )}
            />

            <CustomModal
                isOpen={documentModal} 
                onClose={() => onCloseDocumentModal()} 
                title={payload?.id ? 'Update Employee Document' : 'Add Employee Document'}
                hasRequiredFields={true}
                size="lg"
                showCloseButton
                children={
                    <CustomForm
                        formRef={formRef}
                        initialValues={payload}
                        // validationSchema={benefitValidationSchema}
                        onSubmit={onHandleUpsert}
                        id="identification-document-form"
                        content={(errors, touched) => onRenderDocumentModal(errors, touched)}
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

/**
 * 📥 Inner Drawer Content Component
 * Handles adding, listing, editing, deleting, and previewing documents for a selected employee.
 */
function EmployeeDocumentDrawerContent({ employee }) {
    const employeeId = employee?.id;
    const { documents, loading, handleUpsert, handleDelete } = useEmployeeDocuments(employeeId);

    // Form states
    const [editingId, setEditingId] = useState(null);
    const [label, setLabel] = useState('');
    const [type, setType] = useState('pdf');
    const [fileLink, setFileLink] = useState('');

    // Document Preview Modal State
    const [previewDoc, setPreviewDoc] = useState(null);

    const resetForm = () => {
        setEditingId(null);
        setLabel('');
        setType('pdf');
        setFileLink('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!label || !fileLink || !employeeId) return;

        await handleUpsert({
            ...(editingId && { id: editingId }),
            employee_id: employeeId,
            label,
            type,
            file_link: fileLink
        });

        resetForm();
    };

    const handleEditClick = (doc) => {
        setEditingId(doc.id);
        setLabel(doc.label);
        setType(doc.type);
        setFileLink(doc.file_link);
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h3 className="text-lg font-bold text-slate-800">
                    Documents for {employee?.name || 'Employee'}
                </h3>
                <p className="text-xs text-slate-500">
                    Attach, edit, or remove identification files (PDF/Images).
                </p>
            </div>

            {/* Document Entry Form */}
            <form onSubmit={handleSubmit} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    {editingId ? '✏️ Edit Identification Record' : '➕ Attach New Document'}
                </h4>
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Document Label</label>
                        <input
                            type="text"
                            placeholder="e.g. Resume, Government ID, Medical"
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            required
                            className="w-full border border-slate-300 p-2 rounded-lg text-xs bg-white focus:outline-blue-500"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">File Format</label>
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                                className="w-full border border-slate-300 p-2 rounded-lg text-xs bg-white focus:outline-blue-500"
                            >
                                <option value="pdf">PDF Document</option>
                                <option value="image">Image File</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">File URL / Link</label>
                            <input
                                type="url"
                                placeholder="https://..."
                                value={fileLink}
                                onChange={(e) => setFileLink(e.target.value)}
                                required
                                className="w-full border border-slate-300 p-2 rounded-lg text-xs bg-white focus:outline-blue-500"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    {editingId && (
                        <button
                            type="button"
                            onClick={resetForm}
                            className="px-3 py-1.5 border rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100"
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:bg-blue-300 transition"
                    >
                        {loading ? 'Saving...' : editingId ? 'Update Record' : 'Save Document'}
                    </button>
                </div>
            </form>

            {/* Document Listing Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 font-semibold text-slate-600 border-b">
                        <tr>
                            <th className="p-3">Label</th>
                            <th className="p-3">Type</th>
                            <th className="p-3">Link</th>
                            <th className="p-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                        {loading && documents.length === 0 ? (
                            <tr>
                                <td colSpan="4" className="p-4 text-center text-slate-400">Loading documents...</td>
                            </tr>
                        ) : documents.length === 0 ? (
                            <tr>
                                <td colSpan="4" className="p-4 text-center text-slate-400">No documents attached yet.</td>
                            </tr>
                        ) : (
                            documents.map((doc) => (
                                <tr key={doc.id} className="hover:bg-slate-50">
                                    <td className="p-3 font-medium text-slate-800">{doc.label}</td>
                                    <td className="p-3">
                                        <span className={`inline-block px-2 py-0.5 font-semibold rounded-md text-[10px] uppercase ${
                                            doc.type === 'pdf' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                        }`}>
                                            {doc.type}
                                        </span>
                                    </td>
                                    <td className="p-3">
                                        <button
                                            type="button"
                                            onClick={() => setPreviewDoc(doc)}
                                            className="text-blue-600 hover:underline font-medium text-xs flex items-center gap-1"
                                        >
                                            👁️ Preview
                                        </button>
                                    </td>
                                    <td className="p-3 text-right space-x-2">
                                        <button
                                            type="button"
                                            onClick={() => handleEditClick(doc)}
                                            className="text-amber-600 font-medium hover:underline"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(doc.id)}
                                            className="text-red-600 font-medium hover:underline"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Document Preview Modal Overlay */}
            {previewDoc && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl h-[75vh] flex flex-col overflow-hidden">
                        <div className="p-3 border-b flex justify-between items-center bg-slate-50">
                            <h4 className="font-semibold text-slate-800 text-xs">
                                {previewDoc.label} ({previewDoc.type.toUpperCase()})
                            </h4>
                            <button
                                type="button"
                                onClick={() => setPreviewDoc(null)}
                                className="text-slate-400 hover:text-slate-600 text-sm font-bold px-2"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="flex-1 bg-slate-100 p-2 overflow-auto flex items-center justify-center">
                            {previewDoc.type === 'pdf' ? (
                                <iframe
                                    src={previewDoc.file_link}
                                    title={previewDoc.label}
                                    className="w-full h-full border-0 rounded-lg shadow-sm"
                                />
                            ) : (
                                <img
                                    src={previewDoc.file_link}
                                    alt={previewDoc.label}
                                    className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Identification;