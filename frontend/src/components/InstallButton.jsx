import { Download } from "lucide-react";
import { useInstall } from "../install";
import { useLanguage } from "../i18n/language-context";
import { btnSecondary } from "../ui";

// Quiet by design: only shows when the browser says the site can be installed, never pops up by itself.
export function HeaderInstallButton() {
    const { canInstall, installed, install } = useInstall()
    const { t } = useLanguage()
    if (installed || !canInstall) return null

    return (
        <button
            type="button"
            onClick={install}
            title={t("install.headerTitle")}
            aria-label={t("install.button")}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 text-sm font-medium
                       text-muted hover:bg-surface-2 hover:text-ink sm:h-8"
        >
            <Download size={16} strokeWidth={1.75} aria-hidden="true" />
            <span className="hidden sm:inline">{t("install.button")}</span>
        </button>
    )
}

export function InstallSection() {
    const { canInstall, installed, ios, install } = useInstall()
    const { t } = useLanguage()
    if (installed || (!canInstall && !ios)) return null

    return (
        <div className="mt-4 border-t border-border pt-4">
            <p className="text-sm font-medium text-ink">{t("install.title")}</p>
            <p className="mt-1 text-sm text-muted">{t("install.body")}</p>
            {canInstall ? (
                <button type="button" onClick={install} className={`${btnSecondary} mt-3`}>
                    <Download size={16} strokeWidth={1.75} aria-hidden="true" />
                    {t("install.button")}
                </button>
            ) : (
                <p className="mt-2 text-sm text-muted">
                    {t("install.iosBefore")} <span className="font-medium text-ink">Share</span> {t("install.iosThen")}{" "}
                    <span className="font-medium text-ink">Add to Home Screen</span>.
                </p>
            )}
        </div>
    )
}
