import { Navigate } from "react-router-dom";
import { useAuth } from "../auth-context";
import LoadingScreen from "./LoadingScreen";

function RequireVerified({ children }) {
    const { user, loading } = useAuth()

    if (loading) {
        return <LoadingScreen />
    }

    if (user && !user.is_verified) {
        return <Navigate to="/verify-email" replace />
    }

    return children
}

export default RequireVerified
