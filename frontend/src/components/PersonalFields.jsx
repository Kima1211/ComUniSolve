import { useLanguage } from "../i18n/language-context";
import { inputClass } from "../form";
import { SUFFIXES } from "../validation";
import FormField from "./FormField";

const today = () => new Date().toISOString().slice(0, 10)

// Atomized personal information, shared by Register and Edit profile.
// person/setPerson come from the parent's useState, so the parent can validate and submit them.
function PersonalFields({ person, setPerson, errors = {}, disabled }) {
    const { t } = useLanguage()
    const set = (field) => (e) => setPerson((p) => ({ ...p, [field]: e.target.value }))

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

            <FormField id="birth_date" label={t("personal.birthDate")} error={errors.birth_date} errorParams={{ age: 13 }}>
                <input id="birth_date" type="date" className={inputClass(errors.birth_date)} disabled={disabled}
                       min="1900-01-01" max={today()} autoComplete="bday"
                       value={person.birth_date} onChange={set("birth_date")} />
            </FormField>

            <p className="text-xs text-slate-500">{t("personal.privacy")}</p>
        </div>
    )
}

export default PersonalFields
