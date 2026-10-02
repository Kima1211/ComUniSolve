import { Star } from "lucide-react";
import { useLanguage } from "../i18n/language-context";

// The poster's 1-5 rating of an accepted solution. Gold, because it belongs to the "solved" moment
// (DESIGN.md reserves gold for that). The dark On Gold outline keeps the shape readable on white,
// and filled vs. outline tells the stars apart without relying on colour.
function Stars({ value, size = 16 }) {
    const { t } = useLanguage()
    const text = t("common.stars", { count: value })
    return (
        <span role="img" aria-label={text} title={text} className="inline-flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
                <Star
                    key={i}
                    size={size}
                    strokeWidth={1.75}
                    aria-hidden="true"
                    className={i <= value ? "fill-gold text-on-gold" : "fill-none text-border-strong"}
                />
            ))}
        </span>
    )
}

export default Stars
