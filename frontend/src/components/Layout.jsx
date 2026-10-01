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

const navLink = "text-sm font-medium text-slate-600 hover:text-slate-900"
const primaryButton = "rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"

function Layout({ children }) {
    const { user, loading, logout } = useAuth()
    const { t } = useLanguage()
    const navigate = useNavigate()

    async function handleLogout() {
        await logout()
        navigate("/")
    }

    const logoutButton = (
        <button type="button" onClick={handleLogout} className="text-sm font-medium text-slate-500 hover:text-slate-900">
            {t("nav.logout")}
        </button>
    )

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
                <div className="mx-auto max-w-5xl px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                        <Link to="/" className="flex items-center gap-2">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
                                C
                            </span>
                            <span className="text-lg font-bold tracking-tight text-slate-900">ComUniSolve</span>
                        </Link>

                        <div className="flex items-center gap-2 lg:gap-3">
                            <LanguageSwitcher />
                            <HeaderInstallButton />

                            {/* Wide screens: everything on one row. */}
                            {!loading && (
                                <div className="hidden items-center gap-3 lg:flex">
                                    {user ? (
                                        <>
                                            <Link to="/postproblem" className={primaryButton}>{t("nav.postProblem")}</Link>
                                            {user.role === "admin" && (
                                                <Link to="/admin/overview" className={navLink}>{t("nav.admin")}</Link>
                                            )}
                                            <Link to="/profile" title={t("nav.myProfile")} className="flex items-center gap-2 hover:opacity-80">
                                                <span className="text-sm font-medium text-slate-700">{user.name}</span>
                                                <TierBadge tier={user.tier} />
                                            </Link>
                                            {logoutButton}
                                        </>
                                    ) : (
                                        <>
                                            <Link to="/login" className={navLink}>{t("nav.login")}</Link>
                                            <Link to="/register" className={primaryButton}>{t("nav.register")}</Link>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Phones and tablets: actions get their own second row instead of wrapping unevenly. */}
                    {!loading && (
                        <div className={`mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 lg:hidden ${user ? "justify-between" : "justify-end"}`}>
                            {user ? (
                                <>
                                    <Link to="/postproblem" className={primaryButton}>{t("nav.postProblem")}</Link>
                                    <div className="flex items-center gap-3">
                                        {user.role === "admin" && (
                                            <Link to="/admin/overview" className={navLink}>{t("nav.admin")}</Link>
                                        )}
                                        <Link to="/profile" className={navLink}>{t("nav.myProfile")}</Link>
                                        {logoutButton}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <Link to="/login" className={navLink}>{t("nav.login")}</Link>
                                    <Link to="/register" className={primaryButton}>{t("nav.register")}</Link>
                                </>
                            )}
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
