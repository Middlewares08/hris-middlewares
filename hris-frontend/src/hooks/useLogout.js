// useLogout.js
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { clearPermissions } from "../utils/permissionCheck";

export const useLogout = () => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const logout = () => {
        // MUST MATCH: If you saved it as "token", remove "token"
        localStorage.removeItem("token");
        localStorage.removeItem("accessToken");
        clearPermissions();

        // Clear the cache so ["authUser"] becomes undefined immediately
        queryClient.setQueryData(["authUser"], null); 
        queryClient.clear();

        // Redirect
        navigate("/auth/login", { replace: true });
    };

    return logout;
};