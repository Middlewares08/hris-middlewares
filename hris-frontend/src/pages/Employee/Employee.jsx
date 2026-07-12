import { useState } from "react";
import CustomLabel from "../../components/CustomLabel";
import { Search, Filter, MoreVertical, Plus, UserCheck, ShieldAlert } from 'lucide-react';
import { CustomDataTable } from "../../components/CustomDataTable";

function Employee() {
    const [selectedEmployee, setSelectedEmployee] = useState(null);


    const mockEmployees = [
        { id: 1, name: 'Rico Manabat', department: 'Engineering' }
    ];
    const columnsConfig = [
        { header: 'Full Name', accessor: 'name' },
        { header: 'Department', accessor: 'department' }
    ];

    const renderActionButton = () => (
        <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700">
                <Plus size={16} /> Add Employee
            </button>
        </div>
    )
 

    return (
        <div className="max-w-7xl mx-auto space-y-6 ">
            <div className="flex justify-between border-b border-slate-100 pb-4">
                <div className="flex gap-2 justify-start">
                    <CustomLabel
                        variant='h2' 
                        children='Employee List' 
                        addedClass='font-bold text-slate-700! item-left' 
                        descriptionClass='text-sm text-slate-500'
                        description={`Lorem ipsume...`}
                    />
                </div>
            </div>
            
            <CustomDataTable
                data={mockEmployees}
                columns={columnsConfig}
                isLoading={false}
                actionButton={renderActionButton()}
                filterContent
                renderDrawerContent={(role, closeDrawer) => {
                    // 💡 You can run logs or handle functions inside the block before returning JSX
                    const handleDeactivate = async () => {
                        // await api.delete(`/roles/${role.id}`);
                        closeDrawer(); // Close the drawer automatically when the action completes!
                    };

                    return (
                    <div className="p-2 space-y-6">
                        <div>
                            <h3 className="text-base font-bold text-gray-800">Manage System Tokens</h3>
                            <p className="text-xs text-gray-500">Modifying access configurations for: <b>{role.name}</b></p>
                        </div>

                        {/* Dynamic Action Trigger */}
                        <button 
                            onClick={handleDeactivate}
                            className="w-full py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-semibold hover:bg-red-100 transition-colors"
                        >
                            Deactivate Role
                        </button>
                    </div>
                    );
                }}
            />

        
        </div>
    );
}

export default Employee;