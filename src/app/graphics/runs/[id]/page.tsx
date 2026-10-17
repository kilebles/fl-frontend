import { Suspense } from "react"

import { InfographicRunView } from "@/components/infographics/run-view"

export default function Page({ params }: PageProps<"/graphics/runs/[id]">) {
  return <Suspense>{params.then(({ id }) => <InfographicRunView id={id} />)}</Suspense>
}
