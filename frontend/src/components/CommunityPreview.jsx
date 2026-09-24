import { useEffect, useState } from "react";
import { apiGet } from "../api";

const HOW_IT_WORKS = [
    { title: "Post a problem", body: "Describe something your community is dealing with." },
    { title: "Get real solutions", body: "Neighbours answer, and the best answer gets accepted." },
    { title: "Build reputation", body: "Helpful members earn points and recognised titles." },
]

function CommunityPreview() {
    const [problems, setProblems] = useState([])

    useEffect(() => {
        let cancelled = false

        apiGet("/problems")
            .then((data) => {
                if (cancelled) return
                setProblems(Array.isArray(data) ? data.slice(0, 3) : [])
            })
            .catch(() => {
                if (!cancelled) setProblems([])
            })

        return () => { cancelled = true }
    }, [])

    return (
        <div className="hidden lg:flex flex-col justify-center bg-gradient-to-br from-brand-700 to-brand-900 px-12 py-16 text-white">
            <div className="max-w-md">
                <h2 className="text-3xl font-bold leading-tight">
                    Community problems,<br />community solutions.
                </h2>
                <p className="mt-4 text-brand-100">
                    A place for neighbours to ask for help with everyday problems —
                    and for the people who know the answer to share it.
                </p>

                {problems.length > 0 ? (
                    <div className="mt-10">
                        <p className="text-xs font-semibold uppercase tracking-wider text-brand-200">
                            Recently posted
                        </p>
                        <div className="mt-4 space-y-3">
                            {problems.map((problem) => (
                                <div
                                    key={problem.id}
                                    className="rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <h3 className="font-semibold text-white">{problem.title}</h3>
                                        <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-0.5 text-xs text-brand-50">
                                            {problem.category}
                                        </span>
                                    </div>
                                    {problem.description && (
                                        <p className="mt-1.5 text-sm text-brand-100 line-clamp-2">
                                            {problem.description}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="mt-10 space-y-5">
                        {HOW_IT_WORKS.map((step, index) => (
                            <div key={step.title} className="flex gap-4">
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-semibold">
                                    {index + 1}
                                </span>
                                <div>
                                    <p className="font-semibold">{step.title}</p>
                                    <p className="text-sm text-brand-100">{step.body}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

export default CommunityPreview
