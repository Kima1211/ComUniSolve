import { useInstall } from "../install";

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
    if (installed || !canInstall) return null

    return (
        <button
            type="button"
            onClick={install}
            title="Install ComUniSolve as an app"
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-medium
                       text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        >
            <DownloadIcon />
            <span className="hidden sm:inline">Install app</span>
        </button>
    )
}

export function InstallSection() {
    const { canInstall, installed, ios, install } = useInstall()
    if (installed || (!canInstall && !ios)) return null

    return (
        <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-sm font-medium text-slate-900">Use ComUniSolve like an app</p>
            <p className="mt-1 text-sm text-slate-600">Add it to your home screen for quick access.</p>
            {canInstall ? (
                <button
                    type="button"
                    onClick={install}
                    className="mt-3 flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm
                               font-medium text-slate-700 hover:bg-slate-50"
                >
                    <DownloadIcon />
                    Install app
                </button>
            ) : (
                <p className="mt-2 text-sm text-slate-600">
                    On iPhone: tap <span className="font-medium">Share</span> ⬆️ then{" "}
                    <span className="font-medium">Add to Home Screen</span>.
                </p>
            )}
        </div>
    )
}
