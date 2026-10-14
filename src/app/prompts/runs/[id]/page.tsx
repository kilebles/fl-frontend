import { Suspense } from "react"

import { RunView } from "@/components/prompts/run-view"

export default function Page({ params }: PageProps<"/prompts/runs/[id]">) {
  return <Suspense>{params.then(({ id }) => <RunView id={id} />)}</Suspense>
}
