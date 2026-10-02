import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { useLanguage } from "../i18n/language-context";

const DELAY_MS = 250

// The query lives in the URL (?q=), so it survives a refresh and both boxes stay in sync.
function SearchBox({ className = "" }) {
    const { t } = useLanguage()
    const [params] = useSearchParams()
    const { pathname } = useLocation()
    const navigate = useNavigate()
    const urlQuery = params.get("q") || ""
    const [text, setText] = useState(urlQuery)
    const timer = useRef(null)

    const [lastUrlQuery, setLastUrlQuery] = useState(urlQuery)
    if (urlQuery !== lastUrlQuery) {
        setLastUrlQuery(urlQuery)
        setText(urlQuery)
    }

    useEffect(() => () => clearTimeout(timer.current), [])

    // On the feed, replace the history entry so Back doesn't step through every letter.
    function apply(value) {
        const next = new URLSearchParams(pathname === "/" ? params : undefined)
        if (value.trim()) next.set("q", value.trim())
        else next.delete("q")
        const search = next.toString()
        navigate({ pathname: "/", search: search ? `?${search}` : "" }, { replace: pathname === "/" })
    }

    function handleChange(e) {
        const value = e.target.value
        setText(value)
        clearTimeout(timer.current)
        if (pathname === "/") timer.current = setTimeout(() => apply(value), DELAY_MS)
    }

    function handleSubmit(e) {
        e.preventDefault()
        clearTimeout(timer.current)
        apply(text)
        e.currentTarget.querySelector("input")?.blur() // closes the phone keyboard
    }

    return (
        <form role="search" onSubmit={handleSubmit} className={className}>
            <label className="relative block">
                <span className="sr-only">{t("search.placeholder")}</span>
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
                <input
                    type="search"
                    value={text}
                    onChange={handleChange}
                    placeholder={t("search.placeholder")}
                    enterKeyHint="search"
                    className="h-10 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm placeholder:text-muted focus:bg-surface"
                />
            </label>
        </form>
    )
}

export default SearchBox
