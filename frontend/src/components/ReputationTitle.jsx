import { useLanguage } from "../i18n/language-context";

const K = "#120C08"

const TITLES = {
    "Newcomer": {
        tone: "new",
        palette: { k: K, l: "#86EFAC", g: "#22C55E", d: "#15803D", b: "#7C4A1E", B: "#A0642C" },
        rows: [
            "....kk..kk..", "...klkkkggk.", "..kllllkgggk", "..kllldkgggk", "...kkldkgdk.", ".....kddk...",
            "......dk....", ".....kdk....", "...kkBBBkk..", "..kBbbbbbBk.", "..kkkkkkkkk.", "............",
        ],
    },
    "Contributor": {
        tone: "con",
        palette: { k: K, b: "#0C4A6E", c: "#0284C7", l: "#7DD3FC" },
        rows: [
            "............", "..kk....kk..", ".kbbk..kbbk.", "kb..bkkb..bk", "............", "..kk....kk..",
            ".kcck..kcck.", "kc..ckkc..ck", "............", "..kk....kk..", ".kllk..kllk.", "kl..lkkl..lk",
        ],
    },
    "Trusted Helper": {
        tone: "tru",
        palette: { k: K, v: "#5B21B6", w: "#FFFFFF", p: "#DDD6FE", t: "#99F6E4" },
        rows: [
            "kkkkkkkkkkkk", "kwwpvkkwwpvk", "kwpptkkwpptk", "kpttvkkpttvk", "kvvvvkkvvvvk", "kkkkkkkkkkkk",
            "kkkkkkkkkkkk", "kwwpvkkwwpvk", "kwpptkkwpptk", "kpttvkkpttvk", "kvvvvkkvvvvk", "kkkkkkkkkkkk",
        ],
    },
    "Community Expert": {
        tone: "exp",
        palette: { k: K, y: "#F59E0B", o: "#FCD34D", d: "#B45309", w: "#FFF7D6" },
        rows: [
            ".....kk.....", ".k...yy...k.", "..k..yy..k..", "....kkkk....", "...kowwok...", "yy.kowoook.y",
            ".y.koooook.y", "...kooodk...", "....kkkk....", "..k..yy..k..", ".k...yy...k.", ".....kk.....",
        ],
    },
}

// Glitter specks: [left %, top %, delay in seconds]. Fixed, so every title rises the same calm way.
const SPECKS = [[6, 70, 0], [15, 40, 2.1], [26, 75, 1], [37, 50, 3.2], [48, 72, 0.5], [58, 45, 2.6], [69, 78, 1.6], [80, 52, 3.6], [90, 70, 0.9]]
const SPECKS_SMALL = [[10, 70, 0], [38, 60, 1.6], [64, 72, 0.8], [88, 60, 2.6]]

function Emblem({ title }) {
    return (
        <svg className="rep-title__emblem" viewBox="0 0 12 12" shapeRendering="crispEdges" aria-hidden="true">
            {title.rows.flatMap((row, y) => [...row].map((ch, x) => title.palette[ch] && (
                <rect key={`${x}-${y}`} x={x} y={y} width="1.02" height="1.02" fill={title.palette[ch]} />
            )))}
        </svg>
    )
}

function ReputationTitle({ tier, size = "sm" }) {
    const { label } = useLanguage()
    const title = TITLES[tier] || TITLES.Newcomer
    const large = size === "lg"
    return (
        <span className={`rep-title rep-title--${title.tone} ${large ? "rep-title--lg" : ""}`}>
            <span className="rep-title__glitter" aria-hidden="true">
                {(large ? SPECKS : SPECKS_SMALL).map(([left, top, delay], i) => (
                    <i
                        key={i}
                        className={`rep-title__speck ${i % 3 === 0 ? "rep-title__speck--star" : ""}`}
                        style={{ left: `${left}%`, top: `${top}%`, animationDelay: `${delay}s` }}
                    />
                ))}
            </span>
            <Emblem title={title} />
            <span className="rep-title__text">{label("tier", tier)}</span>
        </span>
    )
}

export default ReputationTitle
