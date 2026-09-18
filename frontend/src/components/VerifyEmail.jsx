import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiGet } from "../api";
import { useAuth } from "../auth-context";

function VerifyEmail() {
    // useParams reads the :token placeholder out of the URL that App.jsx
    // declared for this route.
    const { token } = useParams()
    const { refreshUser } = useAuth()

    const [status, setStatus] = useState("checking")
    const [message, setMessage] = useState("")

    useEffect(() => {
        // This fetch is triggered by the page appearing, not by a user action,
        // which is exactly what useEffect is for - the same reasoning as
        // ProblemFeed, not PostProblem.
        async function verify() {
            try {
                const data = await apiGet(`/verify/${token}`)
                setStatus("success")
                setMessage(data.message || "Email verified successfully")
                // The banner saying "your email is not verified" is driven by
                // is_verified, which the app fetched before this happened.
                // Re-ask, so the UI matches reality without a manual reload.
                refreshUser()
            } catch (e) {
                setStatus("failed")
                setMessage(e.message || "Something went wrong! Please try again.")
            }
        }
        verify()
    }, [token, refreshUser])

    if (status === "checking") {
        return <p>Verifying your email...</p>
    }

    return (
        <div>
            <p style={{ color: status === "success" ? "green" : "red" }}>{message}</p>
            <Link to="/">Go to the problem feed</Link>
        </div>
    )
}

export default VerifyEmail
