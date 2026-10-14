import { Suspense } from "react"

import { InfographicRunView } from "@/components/infographics/run-view"

export default function Page({ params }: PageProps<"/infographics/runs/[id]">) {
  return <Suspense>{params.then(({ id }) => <InfographicRunView id={id} />)}</Suspense>
}
