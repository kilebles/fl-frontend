import { Suspense } from "react"

import { McpDocsView } from "@/components/docs/mcp-docs-view"

export default function DocsPage() {
  return (
    <Suspense fallback={<div className="px-4 pt-8 sm:px-7" />}>
      <McpDocsView />
    </Suspense>
  )
}
