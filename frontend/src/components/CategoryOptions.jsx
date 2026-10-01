import { SECTORS, OTHER } from "../categories";

// The <option>s for a category <select>, grouped under their sector.
function CategoryOptions() {
    return (
        <>
            <option value="" disabled>Choose a category</option>
            {SECTORS.map((sector) => (
                <optgroup key={sector.name} label={sector.name}>
                    {sector.categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </optgroup>
            ))}
            <option value={OTHER}>{OTHER}</option>
        </>
    )
}

export default CategoryOptions
