import { Composer } from "@/components/create/composer"
import { Feed } from "@/components/create/feed"

export default function Page() {
  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 pb-6 sm:px-6 lg:px-10">
        <Feed />
      </div>
      <div className="sticky bottom-0 z-10 bg-linear-to-t from-surface via-surface/95 to-transparent px-4 pt-6 pb-4 sm:px-6 lg:px-10">
        <div className="mx-auto w-full max-w-3xl">
          <Composer />
        </div>
      </div>
    </div>
  )
}
