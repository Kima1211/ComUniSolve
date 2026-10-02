import { Link, useLocation } from "react-router-dom";
import { Home, MapPin, CheckCircle2, GraduationCap, Laptop, ShieldCheck } from "lucide-react";
import { useAuth } from "../auth-context";
import { useLanguage } from "../i18n/language-context";
import { SECTORS } from "../categories";

const SECTOR_ICONS = { Education: GraduationCap, Technology: Laptop }

// Sticky left column. Primary pages up top; sectors with their categories grouped below.
// Active item uses surface-muted bg + primary text, per DESIGN.md sidebar-item-active.
function Item({ to, label, Icon, active }) {
    const base = "flex h-10 items-center gap-3 rounded-md px-3 text-sm"
    const state = active
        ? "bg-surface-2 text-link font-semibold"
        : "text-ink hover:bg-surface-2"
    return (
        <Link to={to} aria-current={active ? "page" : undefined} className={`${base} ${state}`}>
            <Icon size={18} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />
            <span className="truncate">{label}</span>
        </Link>
    )
}

function Section({ title, children }) {
    return (
        <div className="mt-4 first:mt-0">
            <p className="px-3 pb-2 text-xs font-semibold text-muted">{title}</p>
            <div className="space-y-0.5">{children}</div>
        </div>
    )
}

function LeftNav() {
    const { user } = useAuth()
    const { t, label } = useLanguage()
    const { pathname, search } = useLocation()
    const query = new URLSearchParams(search)
    const activeSort = query.get("sort")

    return (
        <nav aria-label={t("leftNav.title")} className="space-y-1">
            <Section title={t("leftNav.feeds")}>
                <Item to="/" label={t("leftNav.home")} Icon={Home} active={pathname === "/" && !activeSort} />
                <Item to="/?sort=unresolved" label={t("leftNav.needsHelp")} Icon={MapPin} active={activeSort === "unresolved"} />
                <Item to="/?sort=solved" label={t("leftNav.solved")} Icon={CheckCircle2} active={activeSort === "solved"} />
            </Section>

            <Section title={t("leftNav.sectors")}>
                {SECTORS.map((sector) => {
                    const Icon = SECTOR_ICONS[sector.name] || Home
                    return (
                        <div key={sector.name}>
                            <Item
                                to={`/?sector=${encodeURIComponent(sector.name)}`}
                                label={label("sector", sector.name)}
                                Icon={Icon}
                                active={query.get("sector") === sector.name}
                            />
                        </div>
                    )
                })}
            </Section>

            {user?.role === "admin" && (
                <Section title={t("leftNav.manage")}>
                    <Item to="/admin/overview" label={t("nav.admin")} Icon={ShieldCheck} active={pathname.startsWith("/admin")} />
                </Section>
            )}
        </nav>
    )
}

export default LeftNav
