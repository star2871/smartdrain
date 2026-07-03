"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUp } from "lucide-react";

const SCROLL_TOP_VISIBILITY_THRESHOLD = 480;

export function MobileDetailQuickActions() {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const updateVisibility = () => {
            setIsVisible(window.scrollY >= SCROLL_TOP_VISIBILITY_THRESHOLD);
        };

        updateVisibility();
        window.addEventListener("scroll", updateVisibility, { passive: true });

        return () => window.removeEventListener("scroll", updateVisibility);
    }, []);

    if (!isVisible) return null;

    return (
        <div className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-40 flex flex-col items-end gap-3 lg:hidden">
            <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="flex size-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="상단으로 이동"
            >
                <ArrowUp className="size-5" />
            </button>
            <Link
                href="/"
                className="flex h-11 items-center gap-1.5 rounded-full bg-slate-900 px-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
                <ArrowLeft className="size-4" />
                대시보드
            </Link>
        </div>
    );
}
