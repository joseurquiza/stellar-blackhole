export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-700 border-t-green-400" />
        <p className="text-sm text-gray-400">Approaching black hole…</p>
      </div>
    </div>
  )
}
