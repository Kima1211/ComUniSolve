import { Link, useLocation } from "react-router-dom";
import { Home, CheckCircle2, Plus, User, LogIn, ShieldCheck } from "lucide-react";
import { useAuth } from "../auth-context";
import { useLanguage } from "../i18n/language-context";

function Tab({ to, label, ariaLabel, Icon, active, emphasis = false }) {
    return (
        <Link
            to={to}
            aria-label={ariaLabel}
            aria-current={active ? "page" : undefined}
            className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 py-1.5 text-[11px] font-medium ${
                active ? "text-link" : "text-muted hover:text-ink"
            }`}
        >
            {/* Same-height icon row on every tab keeps the Post pill in line with the others. */}
            <span className={`flex h-8 items-center justify-center ${
                emphasis ? "w-14 rounded-full bg-primary text-on-primary shine" : ""
            }`}>
                <Icon size={22} strokeWidth={emphasis ? 2.5 : active ? 2.25 : 1.75} aria-hidden="true" />
            </span>
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
            { to: "/postproblem", label: t("nav.post"), ariaLabel: t("nav.postProblem"), Icon: Plus, active: pathname === "/postproblem", emphasis: true },
            ...(user.role === "admin"
                ? [{ to: "/admin/overview", label: t("nav.admin"), Icon: ShieldCheck, active: pathname.startsWith("/admin") }]
                : []),
            { to: "/profile", label: t("nav.myProfile"), Icon: User, active: pathname.startsWith("/profile") || pathname.startsWith("/users") },
        ]
        : [
            { to: "/", label: t("nav.home"), Icon: Home, active: pathname === "/" && !sort },
            { to: "/?sort=solved", label: t("leftNav.solved"), Icon: CheckCircle2, active: sort === "solved" },
            { to: "/login", label: t("nav.post"), ariaLabel: t("nav.postProblem"), Icon: Plus, active: false, emphasis: true },
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
