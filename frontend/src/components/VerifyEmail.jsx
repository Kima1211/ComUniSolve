import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiGet } from "../api";
import { useAuth } from "../auth-context";
import { useLanguage } from "../i18n/language-context";
import Layout from "./Layout";

function VerifyEmail() {
    const { token } = useParams()
    const { refreshUser } = useAuth()
    const { t, errorText } = useLanguage()

    const [status, setStatus] = useState("checking")
    const [error, setError] = useState(null)

    useEffect(() => {
        let cancelled = false
        apiGet(`/verify/${token}`)
            .then(() => {
                if (cancelled) return
                setStatus("success")
                refreshUser()
            })
            .catch((e) => {
                if (cancelled) return
                setStatus("failed")
                setError(e)
            })
        return () => { cancelled = true }
    }, [token, refreshUser])

    return (
        <Layout>
            <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center">
                {status === "checking" && <p className="text-slate-600">{t("verify.checking")}</p>}

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
                            {status === "success" ? t("verify.success") : t("verify.failed")}
                        </h1>
                        <p className="mt-2 text-sm text-slate-600">
                            {status === "success" ? t("verify.successBody") : errorText(error)}
                        </p>
                        <Link
                            to="/"
                            className="mt-6 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                        >
                            {t("verify.goFeed")}
                        </Link>
                    </>
                )}
            </div>
        </Layout>
    )
}

export default VerifyEmail
