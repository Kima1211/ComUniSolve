import Logo from "./Logo"
import { useLanguage } from "../i18n/language-context"

function LoadingScreen() {
    const { t } = useLanguage()

    return (
        <div role="status" className="grid min-h-dvh place-items-center">
            <div className="animate-pulse motion-reduce:animate-none">
                <Logo size={72} />
            </div>
            <span className="sr-only">{t("common.loading")}</span>
        </div>
    )
}

export default LoadingScreen
