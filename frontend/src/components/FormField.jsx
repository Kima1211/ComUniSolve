import { useLanguage } from "../i18n/language-context";

// Label + input + the field's own error message (a translation key), so problems show where they are.
function FormField({ id, label, optional = false, error, errorParams, hint, children }) {
    const { t } = useLanguage()
    return (
        <div>
            <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
                {label}
                {optional && <span className="font-normal text-slate-400"> {t("personal.optional")}</span>}
            </label>
            {children}
            {error
                ? <p className="mt-1 text-xs text-red-600">{t(error, errorParams)}</p>
                : hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </div>
    )
}

export default FormField
