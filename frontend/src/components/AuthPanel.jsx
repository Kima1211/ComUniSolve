import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth-context";

function AuthPanel() {
    const { user, loading, logout } = useAuth()
    const navigate = useNavigate()

    async function handleLogout() {
        await logout()
        navigate("/")
    }

    // Three states, not two. Showing "Log In / Register" while the check is
    // still running makes the panel flicker on every page load for someone
    // who is actually signed in.
    if (loading) {
        return <div><p>...</p></div>
    }

    if (!user) {
        return (
            <div>
                <Link to="/login">Log In</Link>{" "}
                <Link to="/register">Register</Link>
            </div>
        )
    }

    return (
        <div>
            <p>Signed in as <strong>{user.name}</strong> — {user.tier} ({user.points} pts)</p>

            {!user.is_verified && (
                <p style={{ color: '#b45309' }}>
                    Your email is not verified yet. Check your inbox for the
                    verification link — you need it before you can post.
                </p>
            )}

            <Link to="/postproblem">Post a Problem</Link>{" "}
            {user.role === "admin" && <Link to="/admin/overview">Admin</Link>}{" "}
            <button type="button" onClick={handleLogout}>Log Out</button>
        </div>
    )
}

export default AuthPanel
