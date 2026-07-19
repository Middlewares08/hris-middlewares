import CustomLabel from "../../../components/CustomLabel";
import { CustomDataTable } from '../../../components/CustomDataTable';
import { useEmployeeBenefits } from "../../../hooks/useGovernmentDetail";
import { useState } from "react";
import { can } from "../../../utils/permissionCheck";
import CustomButton from "../../../components/CustomButton";
import { PlusIcon } from "lucide-react";
import { CustomAvatar } from "../../../components/CustomAvatar";

function Benifits() {
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const limit = 10;
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
                        </span> : <span className="items-center inline-flex font-mono text-slate-400">N/A</span>
                )
            },
    ]
    
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
                searchPlaceholder="Search by position name or description..."
                isServerSide={true}
                totalRecords={totalRecords}
                currentPage={currentPage}
                recordsPerPage={10}
                onPageChange={handlePageChange}
                onSearch={handleSearch}
                // actionButton={
                //     can('benefits:create') && 
                //     <CustomButton
                //         // onClick={handleOpenCreateModal}
                //         icon={PlusIcon}
                //         iconPosition='left'
                //         type='button'
                //         className='flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors shadow-xs'
                //     />
                // }
                // renderDrawerContent={(dept, closeDrawer) => renderDrawerContent(dept, closeDrawer)}
            />
        </div>
    );
}
export default Benifits;