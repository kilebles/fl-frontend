import { Suspense } from "react"

import { AccountView } from "@/components/account/account-view"

export default function AccountPage() {
  return (
    <Suspense fallback={<div className="px-4 pt-8 sm:px-7" />}>
      <AccountView />
    </Suspense>
  )
}
