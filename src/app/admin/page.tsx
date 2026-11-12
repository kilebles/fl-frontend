import { Suspense } from "react"

import { AdminView } from "@/components/admin/admin-view"

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="px-4 pt-8 sm:px-7" />}>
      <AdminView />
    </Suspense>
  )
}
