import { Link } from "react-router-dom";
import { useLanguage } from "../i18n/language-context";
import Layout from "./Layout";

// Any unknown address lands here instead of a blank page, so there's always a way out.
function NotFound() {
    const { t } = useLanguage()
    return (
        <Layout>
            <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center">
                <h1 className="text-lg font-semibold text-slate-900">{t("notFound.title")}</h1>
                <p className="mt-2 text-sm text-slate-600">{t("notFound.body")}</p>
                <Link
                    to="/"
                    className="mt-6 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                >
                    {t("notFound.home")}
                </Link>
            </div>
        </Layout>
    )
}

export default NotFound
