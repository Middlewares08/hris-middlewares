import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import Loading from "../components/Loading";


const ProtectedRoute = ({ children }) => {
    const location = useLocation();
    
    const { data: authUser, isLoading } = useAuth()

    const token = localStorage.getItem("accessToken");

    if (isLoading) {
        return <Loading size="lg" text='BradSmart' fullPage={true}/>
    }

    if (!authUser && !token) {
        // Redirect to login, but save the current location they were trying to go to
        return <Navigate to="/auth/login" state={{ from: location }} replace />;
    }

    return children;
};

export default ProtectedRoute;