import { useLanguage } from "../i18n/language-context";
import { inputClass } from "../form";
import { SUFFIXES } from "../validation";
import FormField from "./FormField";

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

function PersonalFields({ person, setPerson, errors = {}, disabled }) {
    const { t } = useLanguage()
    const set = (field) => (e) => setPerson((p) => ({ ...p, [field]: e.target.value }))

    // Phones never show a keyboard for type="date", so the birth date is three boxes kept in one
    // "year-month-day" string. Typed parts stay as they are until the form checks them.
    const [year = "", month = "", day = ""] = (person.birth_date || "").split("-")
    const setBirth = (part) => (e) => {
        const value = part === "month" ? e.target.value : e.target.value.replace(/\D/g, "").slice(0, part === "year" ? 4 : 2)
        const parts = { year, month, day, [part]: value }
        const joined = parts.year || parts.month || parts.day ? `${parts.year}-${parts.month}-${parts.day}` : ""
        setPerson((p) => ({ ...p, birth_date: joined }))
    }

    return (
        <div className="space-y-4">
            <FormField id="first_name" label={t("personal.firstName")} error={errors.first_name}>
                <input id="first_name" className={inputClass(errors.first_name)} disabled={disabled} maxLength={100}
                       autoComplete="given-name" value={person.first_name} onChange={set("first_name")} />
            </FormField>
            <FormField id="middle_name" label={t("personal.middleName")} optional error={errors.middle_name}>
                <input id="middle_name" className={inputClass(errors.middle_name)} disabled={disabled} maxLength={100}
                       autoComplete="additional-name" value={person.middle_name} onChange={set("middle_name")} />
            </FormField>
            <FormField id="last_name" label={t("personal.lastName")} error={errors.last_name}>
                <input id="last_name" className={inputClass(errors.last_name)} disabled={disabled} maxLength={100}
                       autoComplete="family-name" value={person.last_name} onChange={set("last_name")} />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
                <FormField id="suffix" label={t("personal.suffix")} optional>
                    <select id="suffix" className={inputClass()} disabled={disabled} value={person.suffix} onChange={set("suffix")}>
                        <option value="">{t("personal.none")}</option>
                        {SUFFIXES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                </FormField>
                <FormField id="sex" label={t("personal.sex")} optional>
                    <select id="sex" className={inputClass()} disabled={disabled} value={person.sex} onChange={set("sex")}>
                        <option value="">{t("personal.sexUnspecified")}</option>
                        <option value="male">{t("personal.sexMale")}</option>
                        <option value="female">{t("personal.sexFemale")}</option>
                    </select>
                </FormField>
            </div>

            <FormField id="birth_month" label={t("personal.birthDate")} error={errors.birth_date} errorParams={{ age: 13 }}>
                <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.2fr)] gap-2">
                    <select id="birth_month" aria-label={t("personal.month")} className={inputClass(errors.birth_date)}
                            disabled={disabled} autoComplete="bday-month"
                            value={month ? String(Number(month)) : ""} onChange={setBirth("month")}>
                        <option value="">{t("personal.month")}</option>
                        {MONTHS.map((m) => <option key={m} value={String(m)}>{t(`month.${m}`)}</option>)}
                    </select>
                    <input id="birth_day" aria-label={t("personal.day")} placeholder={t("personal.day")}
                           inputMode="numeric" autoComplete="bday-day" maxLength={2}
                           className={inputClass(errors.birth_date)} disabled={disabled}
                           value={day} onChange={setBirth("day")} />
                    <input id="birth_year" aria-label={t("personal.year")} placeholder={t("personal.year")}
                           inputMode="numeric" autoComplete="bday-year" maxLength={4}
                           className={inputClass(errors.birth_date)} disabled={disabled}
                           value={year} onChange={setBirth("year")} />
                </div>
            </FormField>

            <p className="text-xs text-muted">{t("personal.privacy")}</p>
        </div>
    )
}

export default PersonalFields
