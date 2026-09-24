import { useState } from "react";
import { apiPost } from "../api";

const REASONS = [
    { value: "spam", label: "Spam or advertising" },
    { value: "inappropriate", label: "Inappropriate content" },
    { value: "harassment", label: "Harassment or abuse" },
    { value: "misleading", label: "Misleading or false" },
    { value: "other", label: "Something else" },
]

function ReportButton({ problemId, solutionId }) {
    const [open, setOpen] = useState(false)
    const [reason, setReason] = useState(REASONS[0].value)
    const [details, setDetails] = useState("")
    const [status, setStatus] = useState("")
    const [error, setError] = useState("")
    const [sending, setSending] = useState(false)

    async function submit() {
        try {
            setSending(true)
            setError("")
            await apiPost("/reports", {
                problem_id: problemId ?? null,
                solution_id: solutionId ?? null,
                reason,
                details: details.trim() || null,
            })
            setStatus("Reported. An admin will review it.")
            setOpen(false)
        } catch (e) {
            if (e.status === 409) {
                setStatus("You have already reported this.")
                setOpen(false)
                return
            }
            setError(e.message || "Could not send the report.")
        } finally {
            setSending(false)
        }
    }

    if (status) {
        return <p className="text-xs text-slate-500">{status}</p>
    }

    if (!open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="text-xs font-medium text-slate-400 hover:text-slate-700"
            >
                Report
            </button>
        )
    }

    return (
        <div className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-700">Why are you reporting this?</p>

            <div className="mt-2 space-y-1">
                {REASONS.map((r) => (
                    <label key={r.value} className="flex items-center gap-2 text-xs text-slate-700">
                        <input
                            type="radio"
                            name={`reason-${problemId ?? "s"}-${solutionId ?? "p"}`}
                            value={r.value}
                            checked={reason === r.value}
                            onChange={() => setReason(r.value)}
                        />
                        {r.label}
                    </label>
                ))}
            </div>

            <textarea
                rows={2}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Anything else the admin should know (optional)"
                className="mt-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs
                           outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
            />

            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

            <div className="mt-2 flex gap-2">
                <button
                    type="button"
                    onClick={submit}
                    disabled={sending}
                    className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white
                               hover:bg-slate-900 disabled:bg-slate-300"
                >
                    {sending ? "Sending..." : "Send report"}
                </button>
                <button
                    type="button"
                    onClick={() => { setOpen(false); setError("") }}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                    Cancel
                </button>
            </div>
        </div>
    )
}

export default ReportButton
