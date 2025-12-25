import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md animate-fade-in">
        <div className="mb-8 flex justify-center">
          <div className="rounded-2xl bg-primary-100 p-6">
            <svg
              className="h-16 w-16 text-primary-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
              />
            </svg>
          </div>
        </div>

        <h1 className="mb-4 text-3xl font-bold text-neutral-900">
          AgroBridge
        </h1>

        <p className="mb-8 text-lg text-neutral-600">
          Trace your food from farm to table.
          <br />
          Meet the farmers. See the journey.
        </p>

        <div className="space-y-3">
          <p className="text-sm text-neutral-500">
            Scan a QR code on your product package to see its full traceability story.
          </p>

          <div className="flex items-center justify-center gap-2 text-sm text-neutral-400">
            <span>Demo:</span>
            <Link
              href="/t/DEMO123"
              className="text-primary-600 hover:text-primary-700 underline"
            >
              View sample batch
            </Link>
          </div>
        </div>
      </div>

      <footer className="absolute bottom-6 text-sm text-neutral-400">
        Powered by AgroBridge Traceability
      </footer>
    </main>
  );
}
