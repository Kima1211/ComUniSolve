import { useLanguage } from "../i18n/language-context";

function FormField({ id, label, optional = false, error, errorParams, hint, children }) {
    const { t } = useLanguage()
    return (
        <div data-invalid={error ? true : undefined}>
            <label htmlFor={id} className="mb-1 block text-sm font-medium text-ink">
                {label}
                {optional && <span className="font-normal text-muted"> {t("personal.optional")}</span>}
            </label>
            {children}
            {error
                ? <p className="mt-1 text-xs text-error">{t(error, errorParams)}</p>
                : hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
        </div>
    )
}

export default FormField
