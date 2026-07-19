import { Navigate } from 'react-router-dom';
import { can } from '../../../utils/permissionCheck'; // Adjust import path as needed

const Index = () => {
    // Define the tabs in order of priority, paired with their respective permission codes
    const tabs = [
        { path: 'identification', permission: 'identifications:view' }, // Use your system's exact permission slugs
        { path: 'benefits', permission: 'benefits:view' },
        { path: 'resume', permission: 'resume:view' }
    ];

    // Find the first tab the user is authorized to see
    const firstAllowedTab = tabs.find(tab => !tab.permission || can(tab.permission));

    if (firstAllowedTab) {
        return <Navigate to={`/dashboard/employee/statutory-and-compliance/${firstAllowedTab.path}`} replace />;
    }

    // Fallback if they have absolutely no access to any sub-tabs
    return <Navigate to="/dashboard" replace />;
};

export default Index;