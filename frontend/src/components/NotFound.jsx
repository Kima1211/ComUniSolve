import { Link } from "react-router-dom";
import { useLanguage } from "../i18n/language-context";
import { btnPrimary, panel } from "../ui";
import Layout from "./Layout";

// Any unknown address lands here instead of a blank page: one sentence and one way out (DESIGN.md empty states).
function NotFound() {
    const { t } = useLanguage()
    return (
        <Layout>
            <div className={`${panel} text-center`}>
                <h1 className="text-[22px] font-semibold leading-[1.3] text-ink">{t("notFound.title")}</h1>
                <p className="mt-2 text-sm text-muted">{t("notFound.body")}</p>
                <Link to="/" className={`${btnPrimary} mt-6`}>{t("notFound.home")}</Link>
            </div>
        </Layout>
    )
}

export default NotFound
