import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md">
        <div className="mb-8 text-8xl font-bold text-neutral-200">404</div>

        <h1 className="mb-4 text-2xl font-bold text-neutral-900">
          Page Not Found
        </h1>

        <p className="mb-8 text-neutral-600">
          This traceability link may have expired, been deactivated, or the URL might be incorrect.
        </p>

        <div className="space-y-3">
          <p className="text-sm text-neutral-500">
            If you scanned a QR code and landed here, the product's traceability data may no longer be available.
          </p>

          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full bg-primary-600 px-6 py-3 font-medium text-white transition hover:bg-primary-700"
          >
            Go to Homepage
          </Link>
        </div>
      </div>
    </main>
  );
}
