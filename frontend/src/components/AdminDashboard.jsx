import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../api";
import Layout from "./Layout";

function StatCard({ label, value }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
        </div>
    )
}

function AdminDashboard() {
    const navigate = useNavigate()

    const [error, setError] = useState("")
    const [total, setTotal] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
        apiGet("/admin/overview")
            .then((data) => { if (!cancelled) setTotal(data) })
            .catch((e) => {
                if (cancelled) return
                if (e.status === 401) { navigate("/login"); return }
                setError(e.message || "Something went wrong! Please try again.")
            })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [navigate])

    return (
        <Layout>
            <h1 className="text-xl font-bold text-slate-900">System overview</h1>
            <p className="mt-1 text-sm text-slate-500">Live counts across the platform.</p>

            {loading && (
                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    {[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-white" />)}
                </div>
            )}

            {error && (
                <p className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            {total && (
                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    <StatCard label="Total users" value={total.total_users} />
                    <StatCard label="Total problems" value={total.total_problems} />
                    <StatCard label="Total solutions" value={total.total_solutions} />
                </div>
            )}
        </Layout>
    )
}

export default AdminDashboard
