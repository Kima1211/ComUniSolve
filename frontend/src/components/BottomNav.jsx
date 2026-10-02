import { Link, useLocation } from "react-router-dom";
import { Home, CheckCircle2, PlusCircle, User, LogIn, ShieldCheck } from "lucide-react";
import { useAuth } from "../auth-context";
import { useLanguage } from "../i18n/language-context";

// Phone-only tab bar. 5 slots: Home, Solved, Post (centre), one role tab, Profile.
// "Communities" and "Notifications" from DESIGN.md map to Solved/Admin here, because
// ComUniSolve has one community and no notifications feature yet.
function Tab({ to, label, Icon, active, emphasis = false }) {
    if (emphasis) {
        return (
            <Link to={to} aria-current={active ? "page" : undefined} className="flex min-w-0 flex-1 items-center justify-center py-1.5">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-on-primary shine">
                    <Icon size={22} strokeWidth={2} aria-hidden="true" />
                </span>
                <span className="sr-only">{label}</span>
            </Link>
        )
    }
    return (
        <Link
            to={to}
            aria-current={active ? "page" : undefined}
            className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                active ? "text-link" : "text-muted hover:text-ink"
            }`}
        >
            <Icon size={22} strokeWidth={active ? 2.25 : 1.75} aria-hidden="true" />
            <span className="truncate">{label}</span>
        </Link>
    )
}

function BottomNav() {
    const { user, loading } = useAuth()
    const { t } = useLanguage()
    const { pathname, search } = useLocation()
    const query = new URLSearchParams(search)
    const sort = query.get("sort")

    if (loading) return null

    const tabs = user
        ? [
            { to: "/", label: t("nav.home"), Icon: Home, active: pathname === "/" && !sort },
            { to: "/?sort=solved", label: t("leftNav.solved"), Icon: CheckCircle2, active: sort === "solved" },
            { to: "/postproblem", label: t("nav.postProblem"), Icon: PlusCircle, active: pathname === "/postproblem", emphasis: true },
            ...(user.role === "admin"
                ? [{ to: "/admin/overview", label: t("nav.admin"), Icon: ShieldCheck, active: pathname.startsWith("/admin") }]
                : []),
            { to: "/profile", label: t("nav.myProfile"), Icon: User, active: pathname.startsWith("/profile") || pathname.startsWith("/users") },
        ]
        : [
            { to: "/", label: t("nav.home"), Icon: Home, active: pathname === "/" && !sort },
            { to: "/?sort=solved", label: t("leftNav.solved"), Icon: CheckCircle2, active: sort === "solved" },
            { to: "/login", label: t("nav.postProblem"), Icon: PlusCircle, active: false, emphasis: true },
            { to: "/login", label: t("nav.login"), Icon: LogIn, active: pathname === "/login" },
            { to: "/register", label: t("nav.register"), Icon: User, active: pathname === "/register" },
        ]

    return (
        <nav
            aria-label={t("nav.bottom")}
            className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface lg:hidden"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
            <div className="mx-auto flex max-w-[720px] items-stretch justify-around">
                {tabs.map((tab, i) => (
                    <Tab key={`${tab.to}-${i}`} {...tab} />
                ))}
            </div>
        </nav>
    )
}

export default BottomNav
