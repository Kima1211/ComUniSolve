import { useCallback, useEffect, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { useLanguage } from "../i18n/language-context";
import { ConfirmContext } from "../confirm-context";
import { inputClass } from "../form";
import { btnDangerSolid, btnPrimary, btnSecondary } from "../ui";

// Focus starts on Cancel (or the reason box), so Enter can't delete something by accident.
export function ConfirmProvider({ children }) {
    const { t } = useLanguage()
    const dialogRef = useRef(null)
    const [request, setRequest] = useState(null)
    // A new request cancels any older one still open, so no caller waits forever.
    const pendingRef = useRef(null)
    const [reason, setReason] = useState("")
    const [missingReason, setMissingReason] = useState(false)

    const confirm = useCallback((options) => new Promise((resolve) => {
        pendingRef.current?.(null)
        pendingRef.current = resolve
        setReason("")
        setMissingReason(false)
        setRequest({ options })
    }), [])

    useEffect(() => {
        const dialog = dialogRef.current
        if (!request || !dialog) return
        if (!dialog.open) dialog.showModal()
        dialog.querySelector("[data-autofocus]")?.focus()
    }, [request])

    function finish(result) {
        pendingRef.current?.(result)
        pendingRef.current = null
        dialogRef.current?.close()
        setRequest(null)
    }

    function submit(e) {
        e.preventDefault()
        if (request.options.reason?.required && !reason.trim()) {
            setMissingReason(true)
            return
        }
        finish({ reason: reason.trim() })
    }

    const o = request?.options
    const danger = (o?.tone || "danger") === "danger"
    const Icon = o?.Icon || TriangleAlert

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            <dialog
                ref={dialogRef}
                role={danger ? "alertdialog" : "dialog"}
                aria-labelledby="confirm-title"
                aria-describedby="confirm-body"
                onCancel={(e) => { e.preventDefault(); finish(null) }}
                onClick={(e) => { if (e.target === dialogRef.current) finish(null) }}
                className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-border bg-surface p-0 text-ink
                           shadow-[var(--shadow-float)] backdrop:bg-black/50"
            >
                {o && (
                    <form onSubmit={submit} noValidate className="p-5">
                        <div className="flex items-start gap-3">
                            <span
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${
                                    danger ? "bg-error-soft text-error" : "bg-primary-soft text-link"
                                }`}
                            >
                                <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                            </span>
                            <div className="min-w-0">
                                <h2 id="confirm-title" className="text-[17px] font-semibold leading-snug text-ink">{o.title}</h2>
                                {o.body && <p id="confirm-body" className="mt-1 text-sm text-muted">{o.body}</p>}
                            </div>
                        </div>

                        {o.preview && (
                            <blockquote className="mt-4 line-clamp-3 whitespace-pre-wrap break-words rounded-md border-l-[3px]
                                                   border-border-strong bg-surface-2 px-3 py-2 text-sm text-ink">
                                {o.preview}
                            </blockquote>
                        )}

                        {o.reason && (
                            <div className="mt-4">
                                <label htmlFor="confirm-reason" className="mb-1 block text-sm font-medium text-ink">
                                    {o.reason.label}
                                    {!o.reason.required && <span className="font-normal text-muted"> {t("personal.optional")}</span>}
                                </label>
                                <textarea
                                    id="confirm-reason"
                                    data-autofocus
                                    rows={3}
                                    maxLength={500}
                                    value={reason}
                                    onChange={(e) => { setReason(e.target.value); setMissingReason(false) }}
                                    className={inputClass(missingReason)}
                                />
                                {missingReason && <p role="alert" className="mt-1 text-xs text-error">{t("admin.reasonRequired")}</p>}
                            </div>
                        )}

                        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <button type="button" onClick={() => finish(null)} className={btnSecondary} {...(o.reason ? {} : { "data-autofocus": true })}>
                                {t("common.cancel")}
                            </button>
                            <button type="submit" className={danger ? btnDangerSolid : btnPrimary}>
                                {o.confirmLabel}
                            </button>
                        </div>
                    </form>
                )}
            </dialog>
        </ConfirmContext.Provider>
    )
}
