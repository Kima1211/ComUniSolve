import { useState } from "react";
import { apiPost } from "../api";
import { useLanguage } from "../i18n/language-context";

const REASONS = [
    { value: "spam" },
    { value: "inappropriate" },
    { value: "harassment" },
    { value: "misleading" },
    { value: "off_topic", problemOnly: true },
    { value: "other" },
]

function ReportButton({ problemId, solutionId, commentId }) {
    const { t, errorText } = useLanguage()
    const [open, setOpen] = useState(false)
    const [reason, setReason] = useState(REASONS[0].value)
    const [details, setDetails] = useState("")
    const [statusKey, setStatusKey] = useState("")
    const [error, setError] = useState(null)
    const [sending, setSending] = useState(false)

    async function submit() {
        try {
            setSending(true)
            setError(null)
            await apiPost("/reports", {
                problem_id: problemId ?? null,
                solution_id: solutionId ?? null,
                comment_id: commentId ?? null,
                reason,
                details: details.trim() || null,
            })
            setStatusKey("report.done")
            setOpen(false)
        } catch (e) {
            if (e.status === 409) {
                setStatusKey("error.already_reported")
                setOpen(false)
                return
            }
            setError(e)
        } finally {
            setSending(false)
        }
    }

    if (statusKey) {
        return <p className="text-xs text-slate-500">{t(statusKey)}</p>
    }

    if (!open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="text-xs font-medium text-slate-400 hover:text-slate-700"
            >
                {t("report.button")}
            </button>
        )
    }

    return (
        <div className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-700">{t("report.why")}</p>

            <div className="mt-2 space-y-1">
                {REASONS.filter((r) => problemId || !r.problemOnly).map((r) => (
                    <label key={r.value} className="flex items-center gap-2 text-xs text-slate-700">
                        <input
                            type="radio"
                            name={`reason-${problemId ?? "s"}-${solutionId ?? "p"}`}
                            value={r.value}
                            checked={reason === r.value}
                            onChange={() => setReason(r.value)}
                        />
                        {t(`report.reason.${r.value}`)}
                    </label>
                ))}
            </div>

            <textarea
                rows={2}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder={reason === "other" ? t("report.detailsRequired") : t("report.detailsOptional")}
                className="mt-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs
                           outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
            />

            {error && <p className="mt-2 text-xs text-red-600">{errorText(error, "report.couldNot")}</p>}

            <div className="mt-2 flex gap-2">
                <button
                    type="button"
                    onClick={submit}
                    disabled={sending || (reason === "other" && !details.trim())}
                    className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white
                               hover:bg-slate-900 disabled:bg-slate-300"
                >
                    {sending ? t("common.sending") : t("report.send")}
                </button>
                <button
                    type="button"
                    onClick={() => { setOpen(false); setError(null) }}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                    {t("common.cancel")}
                </button>
            </div>
        </div>
    )
}

export default ReportButton
