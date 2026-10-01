import { useInstall } from "../install";
import { useLanguage } from "../i18n/language-context";

function DownloadIcon() {
    return (
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4">
            <path d="M10 3a1 1 0 0 1 1 1v7.59l2.3-2.3a1 1 0 1 1 1.4 1.42l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.42L9 11.6V4a1 1 0 0 1 1-1Z" />
            <rect x="4" y="15" width="12" height="2" rx="1" />
        </svg>
    )
}

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
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-medium
                       text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        >
            <DownloadIcon />
            <span className="hidden sm:inline">{t("install.button")}</span>
        </button>
    )
}

export function InstallSection() {
    const { canInstall, installed, ios, install } = useInstall()
    const { t } = useLanguage()
    if (installed || (!canInstall && !ios)) return null

    return (
        <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-sm font-medium text-slate-900">{t("install.title")}</p>
            <p className="mt-1 text-sm text-slate-600">{t("install.body")}</p>
            {canInstall ? (
                <button
                    type="button"
                    onClick={install}
                    className="mt-3 flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm
                               font-medium text-slate-700 hover:bg-slate-50"
                >
                    <DownloadIcon />
                    {t("install.button")}
                </button>
            ) : (
                <p className="mt-2 text-sm text-slate-600">
                    {t("install.iosBefore")} <span className="font-medium">Share</span> ⬆️ {t("install.iosThen")}{" "}
                    <span className="font-medium">Add to Home Screen</span>.
                </p>
            )}
        </div>
    )
}
