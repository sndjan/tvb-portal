import { Skeleton } from "@/components/ui/skeleton";

function TaskCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card px-5 py-6">
      <div className="space-y-3">
        <Skeleton className="h-5 w-2/5" />
        <Skeleton className="h-4 w-4/5" />
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <main className="min-h-screen bg-linear-to-b from-background via-background to-muted/40 pb-14">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pt-8 sm:px-6 lg:px-8">
        <div className="space-y-3 rounded-2xl border bg-card/70 p-5 sm:p-6">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>

        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>

        <div className="grid gap-4">
          <TaskCardSkeleton />
          <TaskCardSkeleton />
          <TaskCardSkeleton />
        </div>
      </section>
    </main>
  );
}
