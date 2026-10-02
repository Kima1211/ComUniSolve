import { Link } from "react-router-dom";
import { useAuth } from "../auth-context";
import { useLanguage } from "../i18n/language-context";

// Floating-to-the-right context panels. Flat surface, 1px border, 12px rounded.
// No shadows — the brief reserves those for menus and modals.
// `wash` adds the faint grey-to-amber gradient; only the first (About) panel uses it.
function Panel({ title, wash = false, children }) {
    return (
        <section className={`rounded-lg border border-border p-4 ${wash ? "card-wash" : "bg-surface"}`}>
            <h2 className="text-sm font-semibold text-ink">{title}</h2>
            <div className="mt-3 text-sm text-muted leading-relaxed">{children}</div>
        </section>
    )
}

function RightRail() {
    const { user } = useAuth()
    const { t } = useLanguage()
    return (
        <div className="space-y-4">
            <Panel title={t("rail.aboutTitle")} wash>
                <p>{t("rail.aboutBody")}</p>
                {!user && (
                    <Link
                        to="/register"
                        className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-on-primary hover:bg-primary-hover shine"
                    >
                        {t("nav.register")}
                    </Link>
                )}
            </Panel>

            <Panel title={t("rail.rulesTitle")}>
                <ol className="list-decimal space-y-1.5 pl-5 text-ink">
                    <li>{t("rail.rule1")}</li>
                    <li>{t("rail.rule2")}</li>
                    <li>{t("rail.rule3")}</li>
                </ol>
            </Panel>

            <Panel title={t("rail.howTitle")}>
                <ol className="list-decimal space-y-1.5 pl-5 text-ink">
                    <li>{t("rail.how1")}</li>
                    <li>{t("rail.how2")}</li>
                    <li>{t("rail.how3")}</li>
                </ol>
            </Panel>
        </div>
    )
}

export default RightRail
