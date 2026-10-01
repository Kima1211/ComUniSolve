import { useLanguage } from "../i18n/language-context";
import { passwordChecks } from "../validation";

// Live list of the password rules: each turns green as soon as it's met.
function PasswordChecklist({ password }) {
    const { t } = useLanguage()
    const checks = passwordChecks(password)

    return (
        <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-xs font-medium text-slate-600">{t("password.title")}</p>
            <ul className="mt-1 space-y-0.5">
                {Object.entries(checks).map(([rule, ok]) => (
                    <li key={rule} className={`flex items-center gap-1.5 text-xs ${ok ? "text-emerald-700" : "text-slate-500"}`}>
                        <span aria-hidden="true">{ok ? "✓" : "○"}</span>
                        {t(`password.rule.${rule}`)}
                    </li>
                ))}
            </ul>
        </div>
    )
}

export default PasswordChecklist
