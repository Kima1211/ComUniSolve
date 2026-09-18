import { useState } from "react";
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { apiPost } from "../api";
import { useAuth } from "../auth-context";

function Login() {
    const navigate = useNavigate()
    const location = useLocation()
    const { refreshUser } = useAuth()

    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [submitting, setSubmitting] = useState(false)

    async function handleSubmit(e) {
        e.preventDefault()   // stop the browser's own full-page form reload

        try {
            setError("")
            setSubmitting(true)

            await apiPost("/login", { email: email, password: password })

            // The login response only sets cookies. The app still does not know
            // who you are until it asks - so ask, and wait for the answer before
            // navigating, or the next page renders as a guest for a moment.
            await refreshUser()

            // RequireAuth stores where the user was heading when it bounced them.
            const goingTo = location.state?.from || "/"
            navigate(goingTo, { replace: true })
        } catch (e) {
            setError(e.message || "Something went wrong! Please try again.")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <form onSubmit={handleSubmit}>
            <input
            type="email"
            placeholder="Enter your email"
            value={email} onChange={(e) => setEmail(e.target.value)}
            />

            <input
            type="password"
            placeholder="Enter your password"
            value={password} onChange={(e) => setPassword(e.target.value)}
            />

            <button type="submit"
            className="submit"
            disabled={submitting}>{submitting ? "Logging in..." : "Submit"}</button>
            {error && <p style={{ color: 'red', marginTop: '5px' }}>{error}</p>}

        <Link to="/register">REGISTER</Link>

        </form>

    )
}

export default Login
