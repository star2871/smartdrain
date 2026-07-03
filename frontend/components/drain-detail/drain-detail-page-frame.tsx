import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { MobileDetailQuickActions } from "@/components/drain-detail/mobile-scroll-top-button";
import type { DrainFacility } from "@/lib/mock-data";

export function DrainDetailPageFrame({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            <AppHeader />
            <main className="mx-auto max-w-[1600px] p-4 pb-[calc(env(safe-area-inset-bottom)+5rem)] md:p-6 lg:pb-6">{children}</main>
            <MobileDetailQuickActions />
        </div>
    );
}

export function DrainDetailPageHeader({ drain }: { drain: DrainFacility }) {
    return (
        <>
            <BackToDashboardLink />
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-slate-100">
                    하수구 상세 정보
                </h1>
                <span className="min-w-0 break-words text-sm font-medium text-slate-500 dark:text-slate-400">
                    {drain.id} · {drain.road}
                </span>
            </div>
        </>
    );
}

export function DrainDetailLoadingPage() {
    return (
        <DrainDetailPageFrame>
            <div className="rounded-xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center text-sm font-medium text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500">
                배수 시설 상세 데이터를 불러오고 있습니다.
            </div>
        </DrainDetailPageFrame>
    );
}

export function DrainDetailErrorPage({ message }: { message: string }) {
    return (
        <DrainDetailPageFrame>
            <BackToDashboardLink />
            <div className="mt-5 rounded-xl border border-red-100 bg-white p-5 shadow-sm dark:border-red-950/60 dark:bg-slate-900">
                <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    상세 정보를 표시할 수 없습니다.
                </h1>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    {message} 백엔드 서버 연결 상태를 확인한 뒤 다시 시도해주세요.
                </p>
            </div>
        </DrainDetailPageFrame>
    );
}

function BackToDashboardLink() {
    return (
        <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
            <ArrowLeft className="size-4" />
            대시보드로 돌아가기
        </Link>
    );
}
