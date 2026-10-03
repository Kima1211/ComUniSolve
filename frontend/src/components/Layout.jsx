import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth-context";
import { useLanguage } from "../i18n/language-context";
import { HeaderInstallButton } from "./InstallButton";
import LanguageSwitcher from "./LanguageSwitcher";
import ThemeToggle from "./ThemeToggle";
import BottomNav from "./BottomNav";
import Logo from "./Logo";
import LeftNav from "./LeftNav";
import RightRail from "./RightRail";
import Avatar from "./Avatar";
import SearchBox from "./SearchBox";
import { useHomeClick } from "../home-refresh";
import NotificationBell from "./NotificationBell";

function TierBadge({ tier }) {
    const { label } = useLanguage()
    const colours = {
        "Newcomer": "bg-surface-2 text-muted",
        "Contributor": "bg-primary-soft text-link",
        "Trusted Helper": "bg-primary-soft text-link",
        "Community Expert": "bg-primary text-on-primary shine",
    }
    return (
        <span className={`rounded-sm px-2 py-0.5 text-xs font-medium ${colours[tier] || colours.Newcomer}`}>
            {label("tier", tier)}
        </span>
    )
}

const navLink = "text-sm font-medium text-muted hover:text-ink"
// No display class here: it would override `hidden` and show the buttons on phones.
const primaryButton = "items-center justify-center whitespace-nowrap rounded-md bg-primary px-4 h-10 text-sm font-semibold text-on-primary hover:bg-primary-hover shine"
const secondaryButton = "items-center justify-center whitespace-nowrap rounded-md border border-border bg-surface px-4 h-10 text-sm font-semibold text-link hover:bg-surface-2"

function Layout({ children, hideRails = false, rail = null, wide = false }) {
    const { user, loading, logout } = useAuth()
    const { t } = useLanguage()
    const navigate = useNavigate()
    const homeClick = useHomeClick()

    async function handleLogout() {
        await logout()
        navigate("/")
    }

    return (
        <div className="min-h-screen bg-page pb-nav">
            <header className="brand-line sticky top-0 z-20 h-14 border-b border-border bg-surface">
                <div className="mx-auto flex h-full max-w-[1324px] items-center gap-4 px-4">
                    <Link to="/" onClick={homeClick} aria-label="ComUniSolve" className="flex items-center gap-2 shrink-0">
                        <Logo size={28} />
                        <span className="text-lg font-semibold text-ink hidden sm:inline">ComUniSolve</span>
                    </Link>

                    <SearchBox className="hidden flex-1 max-w-[560px] md:block" />

                    <div className="ml-auto flex items-center gap-2">
                        {!loading && user && (
                            <Link to="/postproblem" className={`${primaryButton} hidden md:inline-flex`}>
                                {t("nav.postProblem")}
                            </Link>
                        )}
                        {!loading && user && <NotificationBell />}
                        <ThemeToggle />
                        <LanguageSwitcher />
                        <HeaderInstallButton />
                        {!loading && user ? (
                            <>
                                <Link
                                    to="/profile"
                                    title={t("nav.myProfile")}
                                    className="hidden h-10 items-center gap-2 rounded-md pl-1 pr-2 hover:bg-surface-2 md:inline-flex"
                                >
                                    <Avatar name={user.name} size="sm" />
                                    <span className="text-sm font-medium text-ink hidden lg:inline">{user.name}</span>
                                </Link>
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    className={`${navLink} hidden lg:inline`}
                                >
                                    {t("nav.logout")}
                                </button>
                                {user.role === "admin" && (
                                    <Link to="/admin/overview" className={`${navLink} hidden lg:inline`}>{t("nav.admin")}</Link>
                                )}
                            </>
                        ) : !loading && (
                            <>
                                <Link to="/login" className={`${secondaryButton} hidden sm:inline-flex`}>{t("nav.login")}</Link>
                                <Link to="/register" className={`${primaryButton} hidden sm:inline-flex`}>{t("nav.register")}</Link>
                            </>
                        )}
                    </div>
                </div>
            </header>

            <div className={`mx-auto grid max-w-[1324px] grid-cols-1 gap-6 px-4 py-6 ${
                wide
                    ? "lg:grid-cols-[240px_minmax(0,1fr)]"
                    : "lg:grid-cols-[240px_minmax(0,720px)] xl:grid-cols-[240px_minmax(0,720px)_316px]"
            }`}>
                <aside className="hidden lg:block">
                    <div className="sticky top-20">
                        <LeftNav />
                    </div>
                </aside>

                <main className="min-w-0">{children}</main>

                {!hideRails && !wide && (
                    <aside className="hidden xl:block">
                        {rail || <RightRail />}
                    </aside>
                )}
            </div>

            <BottomNav />
        </div>
    )
}

export { TierBadge }
export default Layout
