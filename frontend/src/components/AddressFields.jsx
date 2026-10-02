import { useEffect, useState } from "react";
import { apiGet } from "../api";
import { useLanguage } from "../i18n/language-context";
import { inputClass } from "../form";
import { NO_PROVINCE } from "../validation";
import FormField from "./FormField";

function useOptions(path, key) {
    const [result, setResult] = useState({ key: null, data: null, failed: false })

    useEffect(() => {
        if (!path) return
        let cancelled = false
        apiGet(path)
            .then((data) => { if (!cancelled) setResult({ key, data, failed: false }) })
            .catch(() => { if (!cancelled) setResult({ key, data: null, failed: true }) })
        return () => { cancelled = true }
    }, [path, key])

    return result.key === key ? result : { data: null, failed: false }
}

function AddressFields({ address, setAddress, errors = {}, disabled }) {
    const { t } = useLanguage()
    const { region_code: region, province_code: province, city_code: city } = address

    const regions = useOptions("/locations/regions", "regions")
    const provinces = useOptions(region ? `/locations/provinces?region=${region}` : null, region)
    const cityPath = region && province
        ? `/locations/cities?region=${region}${province !== NO_PROVINCE ? `&province=${province}` : ""}`
        : null
    const cities = useOptions(cityPath, `${region}|${province}`)
    const barangays = useOptions(city ? `/locations/barangays?city=${city}` : null, city)

    const provinceList = provinces.data?.provinces || []
    const noProvinces = provinces.data && provinceList.length === 0
    const failed = regions.failed || provinces.failed || cities.failed || barangays.failed

    function chooseRegion(e) {
        setAddress((a) => ({ ...a, region_code: e.target.value, province_code: "", city_code: "", barangay_code: "" }))
    }
    function chooseProvince(e) {
        setAddress((a) => ({ ...a, province_code: e.target.value, city_code: "", barangay_code: "" }))
    }
    function chooseCity(e) {
        setAddress((a) => ({ ...a, city_code: e.target.value, barangay_code: "" }))
    }

    // Metro Manila has no provinces: pick "no province" for the user once the region's list arrives.
    useEffect(() => {
        if (noProvinces && province !== NO_PROVINCE) {
            setAddress((a) => (a.region_code === region ? { ...a, province_code: NO_PROVINCE } : a))
        }
    }, [noProvinces, province, region, setAddress])

    const placeholder = (loading) => <option value="" disabled>{loading ? t("common.loading") : t("address.choose")}</option>

    return (
        // Container query: two columns only when this box is wide (Edit profile), one in the sign-up panel.
        <div className="@container">
        <div className="grid gap-4 @md:grid-cols-2">
            <FormField id="region" label={t("address.region")} error={errors.region_code}>
                <select id="region" className={inputClass(errors.region_code)} disabled={disabled || !regions.data}
                        value={region} onChange={chooseRegion}>
                    {placeholder(!regions.data)}
                    {(regions.data || []).map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
                </select>
            </FormField>

            <FormField id="province" label={t("address.province")} error={errors.province_code}>
                <select id="province" className={inputClass(errors.province_code)}
                        disabled={disabled || !region || !provinces.data || noProvinces}
                        value={province} onChange={chooseProvince}>
                    {placeholder(region && !provinces.data)}
                    {provinceList.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
                    {provinces.data?.independent_cities && (
                        <option value={NO_PROVINCE}>{noProvinces ? t("address.notApplicable") : t("address.noProvince")}</option>
                    )}
                </select>
            </FormField>

            <FormField id="city" label={t("address.city")} error={errors.city_code}>
                <select id="city" className={inputClass(errors.city_code)} disabled={disabled || !cities.data}
                        value={city} onChange={chooseCity}>
                    {placeholder(cityPath && !cities.data)}
                    {(cities.data || []).map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
            </FormField>

            <FormField id="barangay" label={t("address.barangay")} error={errors.barangay_code}>
                <select id="barangay" className={inputClass(errors.barangay_code)} disabled={disabled || !barangays.data}
                        value={address.barangay_code}
                        onChange={(e) => setAddress((a) => ({ ...a, barangay_code: e.target.value }))}>
                    {placeholder(city && !barangays.data)}
                    {(barangays.data || []).map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
                </select>
            </FormField>

            <div className="@md:col-span-2">
            <FormField id="street" label={t("address.street")} optional error={errors.street}>
                <input id="street" className={inputClass(errors.street)} disabled={disabled} maxLength={255}
                       placeholder={t("address.streetPlaceholder")} autoComplete="address-line1"
                       value={address.street} onChange={(e) => setAddress((a) => ({ ...a, street: e.target.value }))} />
            </FormField>
            </div>

            {failed && <p className="text-xs text-error @md:col-span-2">{t("address.loadFailed")}</p>}
        </div>
        </div>
    )
}

export default AddressFields
