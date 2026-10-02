import { useState } from "react";
import { Flag } from "lucide-react";
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
        return <p className="text-xs text-muted">{t(statusKey)}</p>
    }

    if (!open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex h-10 items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-muted hover:bg-surface-2 hover:text-ink sm:h-8"
            >
                <Flag size={14} strokeWidth={1.75} aria-hidden="true" />
                {t("report.button")}
            </button>
        )
    }

    return (
        <div className="mt-2 w-full rounded-md border border-border bg-surface-2 p-3">
            <p className="text-sm font-semibold text-ink">{t("report.why")}</p>

            <div className="mt-2 space-y-1">
                {REASONS.filter((r) => problemId || !r.problemOnly).map((r) => (
                    <label key={r.value} className="flex min-h-8 items-center gap-2 text-sm text-ink">
                        <input
                            type="radio"
                            name={`reason-${problemId ?? "s"}-${solutionId ?? "p"}-${commentId ?? "c"}`}
                            value={r.value}
                            checked={reason === r.value}
                            onChange={() => setReason(r.value)}
                            className="accent-link"
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
                className="mt-2 w-full rounded-md border border-border px-3 py-2 text-sm"
            />

            {error && <p className="mt-2 text-sm text-error">{errorText(error, "report.couldNot")}</p>}

            <div className="mt-2 flex gap-2">
                <button
                    type="button"
                    onClick={submit}
                    disabled={sending || (reason === "other" && !details.trim())}
                    className="inline-flex h-10 items-center rounded-md border border-border bg-surface px-4 text-sm font-semibold text-link
                               hover:bg-surface-2 disabled:opacity-50"
                >
                    {sending ? t("common.sending") : t("report.send")}
                </button>
                <button
                    type="button"
                    onClick={() => { setOpen(false); setError(null) }}
                    className="inline-flex h-10 items-center rounded-md px-3 text-sm font-medium text-muted hover:text-ink"
                >
                    {t("common.cancel")}
                </button>
            </div>
        </div>
    )
}

export default ReportButton
