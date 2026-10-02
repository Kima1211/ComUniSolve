import { SECTORS, OTHER } from "../categories";
import { useLanguage } from "../i18n/language-context";

// The value sent to the API stays English; only the visible text is translated.
function CategoryOptions() {
    const { t, label } = useLanguage()
    return (
        <>
            <option value="" disabled>{t("category.choose")}</option>
            {SECTORS.map((sector) => (
                <optgroup key={sector.name} label={label("sector", sector.name)}>
                    {sector.categories.map((c) => <option key={c} value={c}>{label("category", c)}</option>)}
                </optgroup>
            ))}
            <option value={OTHER}>{label("category", OTHER)}</option>
        </>
    )
}

export default CategoryOptions
