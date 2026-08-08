export function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div
        className="size-6 animate-spin rounded-full border-2 border-muted border-t-foreground"
        role="status"
        aria-label="Loading"
      />
    </div>
  )
}
