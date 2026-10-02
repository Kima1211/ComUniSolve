import { Check, Circle } from "lucide-react";
import { useLanguage } from "../i18n/language-context";
import { passwordChecks } from "../validation";

// Live list of the password rules: each one gets a check mark as soon as it's met.
// Met rules turn Ink with a check (shape, not just colour, shows the change); unmet ones stay muted.
function PasswordChecklist({ password }) {
    const { t } = useLanguage()
    const checks = passwordChecks(password)

    return (
        <div className="mt-2 rounded-md bg-surface-2 px-3 py-2">
            <p className="text-xs font-medium text-muted">{t("password.title")}</p>
            <ul className="mt-1 space-y-0.5">
                {Object.entries(checks).map(([rule, ok]) => (
                    <li key={rule} className={`flex items-center gap-1.5 text-xs ${ok ? "text-ink" : "text-muted"}`}>
                        {ok
                            ? <Check size={14} strokeWidth={2.25} className="text-link" aria-hidden="true" />
                            : <Circle size={12} strokeWidth={1.75} aria-hidden="true" />}
                        {t(`password.rule.${rule}`)}
                    </li>
                ))}
            </ul>
        </div>
    )
}

export default PasswordChecklist
