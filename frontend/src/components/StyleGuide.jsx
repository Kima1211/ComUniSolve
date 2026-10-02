import { Link } from "react-router-dom";
import Layout from "./Layout";
import Avatar from "./Avatar";
import Logo from "./Logo";

// Not linked from the app: open /_styles to preview colours and components.
function Swatch({ className, label, hex }) {
    return (
        <div className="min-w-24 text-center">
            <div className={`mx-auto h-14 w-14 rounded-xl ${className}`} />
            <p className="mt-1.5 text-xs font-medium text-slate-700">{label}</p>
            <p className="font-mono text-[10px] text-slate-500">{hex}</p>
        </div>
    )
}

function Section({ title, children }) {
    return (
        <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h2>
            <div className="rounded-2xl border border-slate-200 bg-surface p-5">{children}</div>
        </section>
    )
}

function StyleGuide() {
    return (
        <Layout>
            <div className="mx-auto max-w-3xl space-y-8">
                <div className="flex items-center gap-3">
                    <Logo size={48} />
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Style guide</h1>
                        <p className="text-sm text-slate-500">Preview of the new look. Open <code className="font-mono">/_styles</code>.</p>
                    </div>
                </div>

                <Section title="Amber: light / dark (Dark Knight)">
                    <div className="flex flex-wrap gap-3">
                        <Swatch className="bg-canvas"       label="canvas"        hex="#F6F7F9 / #0D0F13" />
                        <Swatch className="bg-surface"      label="surface"       hex="#FFFFFF / #15181E" />
                        <Swatch className="bg-surface-2"    label="surface-2"     hex="#EEF0F3 / #1D2129" />
                        <Swatch className="bg-border"       label="border"        hex="#D9DDE4 / #2A2F38" />
                        <Swatch className="bg-ink"          label="ink"           hex="#1C2230 / #E7E9ED" />
                        <Swatch className="bg-muted"        label="muted"         hex="#576072 / #A2A8B3" />
                        <Swatch className="bg-primary"      label="primary"       hex="#F59E0B" />
                        <Swatch className="bg-primary-soft" label="primary-soft"  hex="#FEF2DF / #2A2414" />
                        <Swatch className="bg-link"         label="link"          hex="#9A5A06 / #F59E0B" />
                        <Swatch className="bg-gold"         label="amber (solved)" hex="#F59E0B" />
                        <Swatch className="bg-gold-soft banner-fade" label="amber-soft" hex="#FDEED3 / #33290F" />
                        <Swatch className="card-wash"       label="card-wash"     hex="grey → amber" />
                        <Swatch className="bg-error"        label="error"         hex="#B3392F / #F08A80" />
                    </div>
                    <p className="mt-4 text-sm text-muted">
                        Colours live as CSS variables in <code className="font-mono">index.css</code>; the toggle in the top bar
                        switches light / dark. Buttons are bright amber with dark text in both modes. Links are deep amber
                        in light mode (bright amber text on white is too faint to read) and bright amber on the
                        near-black dark mode.
                    </p>
                </Section>

                <Section title="Avatar tones">
                    <div className="flex flex-wrap gap-3">
                        <Swatch className="bg-[#374151]" label="charcoal" hex="#374151" />
                        <Swatch className="bg-[#4B5563]" label="slate"    hex="#4B5563" />
                        <Swatch className="bg-[#92400E]" label="bronze"   hex="#92400E" />
                        <Swatch className="bg-[#78350F]" label="umber"    hex="#78350F" />
                    </div>
                    <p className="mt-4 text-sm text-muted">
                        Avatar backgrounds pick one of these from the user's name (stable hash). All are dark enough for white initials.
                    </p>
                </Section>

                <Section title="Typography">
                    <div className="space-y-2">
                        <p className="text-2xl font-bold tracking-tight text-slate-900">Display · 24/32 bold</p>
                        <p className="text-xl font-bold tracking-tight text-slate-900">Heading 1 · 20/28 bold</p>
                        <p className="text-lg font-semibold text-slate-900">Heading 2 · 18/26 semibold</p>
                        <p className="text-base text-slate-700">Body · 16/24 regular. IBM Plex Sans, self-hosted, with a system fallback.</p>
                        <p className="text-sm text-slate-600">Small · 14/20 for cards and lists.</p>
                        <p className="text-xs text-slate-500">Tiny · 12/16 for timestamps and secondary labels.</p>
                    </div>
                </Section>

                <Section title="Avatars">
                    <div className="flex flex-wrap items-end gap-4">
                        {["Rojan Cabrido", "Maria Santos", "Ben Cruz", "Nena Lim", "Juana Dela Cruz", "Lito"].map((name) => (
                            <div key={name} className="flex flex-col items-center gap-1">
                                <Avatar name={name} size="lg" />
                                <p className="text-[11px] text-slate-500">{name.split(" ")[0]}</p>
                            </div>
                        ))}
                    </div>
                    <p className="mt-4 text-sm text-slate-600">
                        Initials-only, with a stable colour per name. No profile picture upload (image moderation isn't built yet).
                    </p>
                </Section>

                <Section title="Buttons">
                    <div className="flex flex-wrap items-center gap-3">
                        <button className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-primary hover:bg-accent-strong">Primary</button>
                        <button className="rounded-lg border border-slate-300 bg-surface px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Secondary</button>
                        <button className="rounded-lg border border-red-200 bg-surface px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">Destructive</button>
                        <button disabled className="cursor-not-allowed rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-primary opacity-50">Disabled</button>
                    </div>
                </Section>

                <Section title="Pills / chips">
                    <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Resolved</span>
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">Open</span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">Devices & Repair</span>
                        <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-700">AI-reviewed</span>
                        <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">3 reports</span>
                    </div>
                </Section>

                <Section title="See it in context">
                    <p className="text-sm text-slate-600">
                        Open <Link to="/" className="font-medium text-brand-700 hover:underline">the feed</Link>{" "}
                        to see the new header, bottom navigation and problem cards.
                    </p>
                </Section>
            </div>
        </Layout>
    )
}

export default StyleGuide
