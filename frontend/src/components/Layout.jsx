import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth-context";
import { useLanguage } from "../i18n/language-context";
import { HeaderInstallButton } from "./InstallButton";
import LanguageSwitcher from "./LanguageSwitcher";

function TierBadge({ tier }) {
    const { label } = useLanguage()
    const colours = {
        "Newcomer": "bg-slate-100 text-slate-600",
        "Contributor": "bg-sky-100 text-sky-700",
        "Trusted Helper": "bg-emerald-100 text-emerald-700",
        "Community Expert": "bg-purple-100 text-purple-700",
    }
    return (
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colours[tier] || colours.Newcomer}`}>
            {label("tier", tier)}
        </span>
    )
}

function Layout({ children }) {
    const { user, loading, logout } = useAuth()
    const { t } = useLanguage()
    const navigate = useNavigate()

    async function handleLogout() {
        await logout()
        navigate("/")
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
                <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
                    <Link to="/" className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
                            C
                        </span>
                        <span className="text-lg font-bold tracking-tight text-slate-900">ComUniSolve</span>
                    </Link>

                    {loading ? null : user ? (
                        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
                            <LanguageSwitcher />
                            <HeaderInstallButton />
                            <Link
                                to="/postproblem"
                                className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
                            >
                                {t("nav.postProblem")}
                            </Link>
                            {user.role === "admin" && (
                                <Link to="/admin/overview" className="text-sm font-medium text-slate-600 hover:text-slate-900">
                                    {t("nav.admin")}
                                </Link>
                            )}
                            <Link to="/profile" className="text-sm font-medium text-slate-600 hover:text-slate-900 sm:hidden">
                                {t("nav.myProfile")}
                            </Link>
                            <Link to="/profile" title={t("nav.myProfile")} className="hidden sm:flex items-center gap-2 hover:opacity-80">
                                <span className="text-sm font-medium text-slate-700">{user.name}</span>
                                <TierBadge tier={user.tier} />
                            </Link>
                            <button
                                type="button"
                                onClick={handleLogout}
                                className="text-sm font-medium text-slate-500 hover:text-slate-900"
                            >
                                {t("nav.logout")}
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
                            <LanguageSwitcher />
                            <HeaderInstallButton />
                            <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">
                                {t("nav.login")}
                            </Link>
                            <Link
                                to="/register"
                                className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
                            >
                                {t("nav.register")}
                            </Link>
                        </div>
                    )}
                </div>
            </header>

            <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        </div>
    )
}

export { TierBadge }
export default Layout
