import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useLanguage } from "../i18n/language-context";

function PasswordInput({ className = "", ...props }) {
    const { t } = useLanguage()
    const [visible, setVisible] = useState(false)
    const Icon = visible ? EyeOff : Eye

    return (
        <div className="relative">
            <input {...props} type={visible ? "text" : "password"} className={`${className} pr-11`} />
            {/* type="button": a plain <button> inside a form would submit it. */}
            <button
                type="button"
                onClick={() => setVisible((v) => !v)}
                disabled={props.disabled}
                aria-label={visible ? t("auth.hidePassword") : t("auth.showPassword")}
                title={visible ? t("auth.hidePassword") : t("auth.showPassword")}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
            >
                <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
        </div>
    )
}

export default PasswordInput
