import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiGet } from "../api";
import { useAuth } from "../auth-context";
import Layout from "./Layout";

function VerifyEmail() {
    const { token } = useParams()
    const { refreshUser } = useAuth()

    const [status, setStatus] = useState("checking")
    const [message, setMessage] = useState("")

    useEffect(() => {
        let cancelled = false
        apiGet(`/verify/${token}`)
            .then((data) => {
                if (cancelled) return
                setStatus("success")
                setMessage(data.message || "Email verified successfully")
                refreshUser()
            })
            .catch((e) => {
                if (cancelled) return
                setStatus("failed")
                setMessage(e.message || "Something went wrong! Please try again.")
            })
        return () => { cancelled = true }
    }, [token, refreshUser])

    return (
        <Layout>
            <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center">
                {status === "checking" && <p className="text-slate-600">Verifying your email...</p>}

                {status !== "checking" && (
                    <>
                        <div
                            className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full text-xl ${
                                status === "success" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                            }`}
                        >
                            {status === "success" ? "✓" : "!"}
                        </div>
                        <h1 className="mt-4 text-lg font-semibold text-slate-900">
                            {status === "success" ? "Email verified" : "Verification failed"}
                        </h1>
                        <p className="mt-2 text-sm text-slate-600">{message}</p>
                        <Link
                            to="/"
                            className="mt-6 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                        >
                            Go to the problem feed
                        </Link>
                    </>
                )}
            </div>
        </Layout>
    )
}

export default VerifyEmail
