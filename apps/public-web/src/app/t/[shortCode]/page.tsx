import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { api, BatchTraceability } from '@/lib/api';
import { VerificationBadge } from '@/components/VerificationBadge';
import { KeyFacts } from '@/components/KeyFacts';
import { JourneyTimeline } from '@/components/JourneyTimeline';
import { DataCards } from '@/components/DataCards';
import { ScanTracker } from '@/components/ScanTracker';

interface PageProps {
  params: Promise<{ shortCode: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { shortCode } = await params;

  try {
    const batch = await api.getBatchTraceability(shortCode);

    return {
      title: `${batch.product.name} from ${batch.farmer.name}`,
      description: `Trace this ${batch.product.name} from ${batch.farmer.region}. Harvested ${batch.product.harvestDate}. ${batch.verificationBadge.status === 'VERIFIED' ? 'Fully verified supply chain.' : ''}`,
      openGraph: {
        title: `${batch.product.name} - Farm to Table Traceability`,
        description: `From ${batch.farmer.name} in ${batch.farmer.region}. ${batch.keyFacts.map(f => `${f.label}: ${f.value}`).slice(0, 2).join('. ')}`,
        images: batch.product.imageUrl ? [batch.product.imageUrl] : [],
        type: 'article',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${batch.product.name} from ${batch.farmer.name}`,
        description: `Trace your food from farm to table. ${batch.verificationBadge.status === 'VERIFIED' ? 'Verified supply chain.' : ''}`,
      },
    };
  } catch {
    return {
      title: 'Batch Not Found',
      description: 'This traceability link may have expired or is invalid.',
    };
  }
}

export default async function BatchPage({ params }: PageProps) {
  const { shortCode } = await params;

  let batch: BatchTraceability;

  try {
    batch = await api.getBatchTraceability(shortCode);
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      notFound();
    }
    throw error;
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-primary-50 to-white pb-20">
      {/* Track scan on client */}
      <ScanTracker shortCode={shortCode} />

      {/* Hero Section - Designed for instant comprehension */}
      <section className="relative overflow-hidden bg-primary-600 px-6 pb-16 pt-12 text-white">
        <div className="absolute inset-0 opacity-10">
          <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect fill="url(#grid)" width="100" height="100" />
          </svg>
        </div>

        <div className="relative mx-auto max-w-lg">
          {/* Verification Badge - Top Priority */}
          <div className="mb-6 flex justify-center animate-fade-in">
            <VerificationBadge
              status={batch.verificationBadge.status}
              score={batch.verificationBadge.score}
              stages={`${batch.verificationBadge.completedStages}/${batch.verificationBadge.totalStages}`}
            />
          </div>

          {/* Product Info */}
          <div className="text-center animate-slide-up">
            <h1 className="mb-2 text-3xl font-bold tracking-tight">
              {batch.product.name}
            </h1>
            {batch.product.variety && (
              <p className="mb-4 text-primary-100">
                {batch.product.variety}
              </p>
            )}

            {/* Farmer Link */}
            <Link
              href={`/f/${batch.farmer.slug || batch.farmer.id}`}
              className="inline-flex items-center gap-3 rounded-full bg-white/10 px-4 py-2 backdrop-blur-sm transition hover:bg-white/20"
            >
              {batch.farmer.photoUrl ? (
                <Image
                  src={batch.farmer.photoUrl}
                  alt={batch.farmer.name}
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-500 text-sm font-medium">
                  {batch.farmer.name.charAt(0)}
                </div>
              )}
              <span className="font-medium">{batch.farmer.name}</span>
              <span className="text-primary-200">{batch.farmer.region}</span>
            </Link>
          </div>
        </div>

        {/* Wave divider */}
        <div className="absolute -bottom-1 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" className="w-full">
            <path
              d="M0 60V30C240 0 480 0 720 30C960 60 1200 60 1440 30V60H0Z"
              className="fill-primary-50"
            />
          </svg>
        </div>
      </section>

      {/* Key Facts - Instant Understanding */}
      <section className="relative z-10 -mt-8 px-6">
        <div className="mx-auto max-w-lg">
          <KeyFacts facts={batch.keyFacts} />
        </div>
      </section>

      {/* Journey Timeline */}
      <section className="mt-10 px-6">
        <div className="mx-auto max-w-lg">
          <h2 className="mb-4 text-lg font-semibold text-neutral-900">
            Journey Timeline
          </h2>
          <JourneyTimeline stages={batch.journey} />
        </div>
      </section>

      {/* Data Cards - Transit, Cold Chain, Seal, Field Health */}
      <section className="mt-10 px-6">
        <div className="mx-auto max-w-lg">
          <h2 className="mb-4 text-lg font-semibold text-neutral-900">
            Traceability Data
          </h2>
          <DataCards
            transit={batch.transit}
            coldChain={batch.coldChain}
            sealStatus={batch.sealStatus}
            fieldHealth={batch.fieldHealth}
            certificate={batch.certificate}
          />
        </div>
      </section>

      {/* Certifications */}
      {batch.farmer.certifications.length > 0 && (
        <section className="mt-10 px-6">
          <div className="mx-auto max-w-lg">
            <h2 className="mb-4 text-lg font-semibold text-neutral-900">
              Certifications
            </h2>
            <div className="flex flex-wrap gap-2">
              {batch.farmer.certifications.map((cert) => (
                <span
                  key={cert}
                  className="badge badge-verified"
                >
                  {cert}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer CTA */}
      <section className="mt-16 px-6">
        <div className="mx-auto max-w-lg text-center">
          <div className="card p-6">
            <p className="mb-4 text-sm text-neutral-600">
              Want to source traceable produce like this?
            </p>
            <a
              href="https://agrobridge.io?ref=trace"
              className="inline-flex items-center justify-center rounded-full bg-primary-600 px-6 py-3 font-medium text-white transition hover:bg-primary-700"
            >
              Learn About AgroBridge
            </a>
          </div>
        </div>
      </section>

      {/* Powered By */}
      <footer className="mt-12 text-center text-sm text-neutral-400">
        <p>Powered by AgroBridge Traceability</p>
        <p className="mt-1 text-xs">Batch: {shortCode}</p>
      </footer>
    </main>
  );
}
