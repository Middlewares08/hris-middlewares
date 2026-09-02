import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import Loading from "../components/Loading";
import { can } from "../utils/permissionCheck";

// The account must carry this to be allowed into the admin dashboard at all.
const CONSOLE_ACCESS = "admin-console:access";

const ProtectedRoute = ({ children }) => {
    const location = useLocation();

    const { data: authUser, isLoading } = useAuth();

    const token = localStorage.getItem("accessToken");

    if (isLoading) {
        return <Loading size="lg" text='BradSmart' fullPage={true} />;
    }

    if (!authUser && !token) {
        // Redirect to login, but save the current location they were trying to go to
        return <Navigate to="/auth/login" state={{ from: location }} replace />;
    }

    // Account is authenticated but not authorised for the admin dashboard
    // (e.g. an employee-only account). Bounce to login.
    if (token && !can(CONSOLE_ACCESS)) {
        return <Navigate to="/auth/login" state={{ from: location, denied: true }} replace />;
    }

    return children;
};

export default ProtectedRoute;
