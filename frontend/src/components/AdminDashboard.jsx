import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../api";

function AdminDashboard() {
    const navigate = useNavigate()

    const [error, setError] = useState("")
    const [total, setTotal] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function loadOverview() {
            try {
                setError("")
                const data = await apiGet("/admin/overview")
                setTotal(data)
            } catch (e) {
                if (e.status === 401) {
                    navigate("/login")
                    return
                }
                setError(e.message || "Something went wrong! Please try again.")
            } finally {
                setLoading(false)
            }
        }
        loadOverview()
    }, [navigate])

    if (loading) {
        return <p>Loading overview...</p>
    }

    if (error) {
        return <p style={{ color: 'red' }}>{error}</p>
    }

    // total is null until a successful fetch fills it, so nothing below ever
    // reads a field off a shape that has not arrived yet.
    if (!total) {
        return null
    }

    return (
        <div>
            <p>Total Users: {total.total_users}</p>
            <p>Total Problems: {total.total_problems}</p>
            <p>Total Solutions: {total.total_solutions}</p>
        </div>
    )
}

export default AdminDashboard
