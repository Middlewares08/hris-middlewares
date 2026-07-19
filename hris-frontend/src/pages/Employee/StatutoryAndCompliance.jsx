import { Outlet } from 'react-router-dom';
import { ShieldCheck, FileText, Landmark } from 'lucide-react'; // Using lucide-react for icons
import CustomTabs from '../../components/CustomTab'; // Path to your file
import CustomLabel from '../../components/CustomLabel';

function StatutoryAndCompliance() {
    // Define your tab configuration
    const complianceTabs = [
        {
            label: 'Identifications',
            path: '/dashboard/employee/statutory-and-compliance/identification',
            icon: ShieldCheck,
            permission: 'identifications:view'
        },
        {
            label: 'Benefits',
            path: '/dashboard/employee/statutory-and-compliance/benefits',
            icon: Landmark,
            permission: 'benefits:view'
        },
        {
            label: 'Resumé',
            path: '/dashboard/employee/statutory-and-compliance/resume',
            icon: FileText,
            permission: 'resume:view'
        },
    ];

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

            {/* Render your CustomTabs component */}
            <CustomTabs 
                tabs={complianceTabs} 
                variant="indigo" 
                iconSize={20} 
                className="mb-4"
            />

            {/* Sub-route pages render here dynamically */}
            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                <Outlet />
            </div>
        </div>
    );
}

export default StatutoryAndCompliance;