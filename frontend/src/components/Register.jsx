import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiPost } from "../api";
import { useAuth } from "../auth-context";

function Register() {
    const navigate = useNavigate()
    const { refreshUser } = useAuth()

    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [submitting, setSubmitting] = useState(false)

    async function handleSubmit(e) {
        e.preventDefault()

        try {
            setError("")
            setSubmitting(true)

            await apiPost("/register", { name: name, email: email, password: password })
            await refreshUser()
            navigate("/")
        } catch (e) {
            setError(e.message || "Something went wrong! Please try again.")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <form onSubmit={handleSubmit}>
            <input
            type="text"
            placeholder="Enter your name"
            value={name} onChange={(e) => setName(e.target.value)}
            />

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
            disabled={submitting}>{submitting ? "Registering..." : "Submit"}</button>
            {error && <p style={{ color: 'red', marginTop: '5px' }}>{error}</p>}

            <Link to="/login">Log In</Link>
        </form>
    )
}

export default Register
