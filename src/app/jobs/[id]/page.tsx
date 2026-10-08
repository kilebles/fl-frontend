import { Suspense } from "react"

import { JobSkeleton, JobView } from "@/components/jobs/job-view"

export default function Page({ params }: PageProps<"/jobs/[id]">) {
  return (
    <Suspense fallback={<JobSkeleton />}>
      {params.then(({ id }) => (
        <JobView id={id} />
      ))}
    </Suspense>
  )
}
