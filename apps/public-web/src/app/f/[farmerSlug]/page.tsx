import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { api, FarmerProfile } from '@/lib/api';
import { format, parseISO } from 'date-fns';
import {
  MapPin,
  Calendar,
  Award,
  TrendingUp,
  Package,
  Scale,
  Star,
  ChevronRight,
} from 'lucide-react';

interface PageProps {
  params: Promise<{ farmerSlug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { farmerSlug } = await params;

  try {
    const farmer = await api.getFarmerProfile(farmerSlug);

    return {
      title: `${farmer.name} - Farmer Profile`,
      description: `Meet ${farmer.name} from ${farmer.region.name}, ${farmer.region.country}. ${farmer.story?.slice(0, 150) || 'A dedicated farmer growing ' + farmer.crops.join(', ')}.`,
      openGraph: {
        title: `${farmer.name} - AgroBridge Farmer`,
        description: `${farmer.stats.yearsActive} years farming. ${farmer.crops.join(', ')}. ${farmer.certifications.length} certifications.`,
        images: farmer.photoUrl ? [farmer.photoUrl] : [],
        type: 'profile',
      },
      twitter: {
        card: 'summary_large_image',
        title: `Meet ${farmer.name}`,
        description: `Farmer from ${farmer.region.name}, ${farmer.region.country}`,
      },
    };
  } catch {
    return {
      title: 'Farmer Not Found',
      description: 'This farmer profile could not be found.',
    };
  }
}

export default async function FarmerPage({ params }: PageProps) {
  const { farmerSlug } = await params;

  let farmer: FarmerProfile;

  try {
    farmer = await api.getFarmerProfile(farmerSlug);
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      notFound();
    }
    throw error;
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-earth-50 to-white pb-20">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-earth-600 to-earth-800 px-6 pb-24 pt-12 text-white">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <pattern id="dots" width="5" height="5" patternUnits="userSpaceOnUse">
                <circle cx="2.5" cy="2.5" r="1" fill="currentColor" />
              </pattern>
            </defs>
            <rect fill="url(#dots)" width="100" height="100" />
          </svg>
        </div>

        <div className="relative mx-auto max-w-lg text-center animate-fade-in">
          {/* Profile Photo */}
          <div className="mb-6 flex justify-center">
            {farmer.photoUrl ? (
              <Image
                src={farmer.photoUrl}
                alt={farmer.name}
                width={120}
                height={120}
                className="rounded-full border-4 border-white shadow-xl"
              />
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-white bg-earth-500 text-4xl font-bold shadow-xl">
                {farmer.name.charAt(0)}
              </div>
            )}
          </div>

          <h1 className="mb-2 text-3xl font-bold tracking-tight">{farmer.name}</h1>

          <div className="flex items-center justify-center gap-2 text-earth-200">
            <MapPin className="h-4 w-4" />
            <span>{farmer.region.name}, {farmer.region.country}</span>
          </div>

          {/* Badges */}
          {farmer.badges.length > 0 && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {farmer.badges.slice(0, 3).map((badge) => (
                <span
                  key={badge.type}
                  className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-sm backdrop-blur-sm"
                >
                  <Star className="h-3 w-3 text-amber-400" />
                  {badge.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Wave divider */}
        <div className="absolute -bottom-1 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" className="w-full">
            <path
              d="M0 60V30C240 0 480 0 720 30C960 60 1200 60 1440 30V60H0Z"
              className="fill-earth-50"
            />
          </svg>
        </div>
      </section>

      {/* Stats Cards */}
      <section className="relative z-10 -mt-12 px-6">
        <div className="mx-auto max-w-lg">
          <div className="grid grid-cols-4 gap-2">
            <div className="key-fact">
              <Calendar className="mb-1 h-4 w-4 text-earth-400" />
              <span className="text-lg font-bold text-neutral-900">{farmer.stats.yearsActive}</span>
              <span className="text-xs text-neutral-500">Years</span>
            </div>
            <div className="key-fact">
              <Package className="mb-1 h-4 w-4 text-earth-400" />
              <span className="text-lg font-bold text-neutral-900">{farmer.stats.totalBatches}</span>
              <span className="text-xs text-neutral-500">Batches</span>
            </div>
            <div className="key-fact">
              <Scale className="mb-1 h-4 w-4 text-earth-400" />
              <span className="text-lg font-bold text-neutral-900">{(farmer.stats.totalVolume / 1000).toFixed(0)}t</span>
              <span className="text-xs text-neutral-500">Volume</span>
            </div>
            <div className="key-fact">
              <TrendingUp className="mb-1 h-4 w-4 text-earth-400" />
              <span className="text-lg font-bold text-neutral-900">{farmer.stats.avgQualityScore || '-'}%</span>
              <span className="text-xs text-neutral-500">Quality</span>
            </div>
          </div>
        </div>
      </section>

      {/* Story */}
      {farmer.story && (
        <section className="mt-10 px-6">
          <div className="mx-auto max-w-lg">
            <h2 className="mb-4 text-lg font-semibold text-neutral-900">My Story</h2>
            <div className="card p-5">
              <p className="text-neutral-600 leading-relaxed whitespace-pre-line">
                {farmer.story}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Crops */}
      <section className="mt-10 px-6">
        <div className="mx-auto max-w-lg">
          <h2 className="mb-4 text-lg font-semibold text-neutral-900">What I Grow</h2>
          <div className="flex flex-wrap gap-2">
            {farmer.crops.map((crop) => (
              <span
                key={crop}
                className="rounded-full bg-primary-100 px-4 py-2 text-sm font-medium text-primary-700"
              >
                {crop}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Certifications */}
      {farmer.certifications.length > 0 && (
        <section className="mt-10 px-6">
          <div className="mx-auto max-w-lg">
            <h2 className="mb-4 text-lg font-semibold text-neutral-900">Certifications</h2>
            <div className="space-y-3">
              {farmer.certifications.map((cert) => (
                <div key={cert.name} className="card flex items-center gap-4 p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                    <Award className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-neutral-900">{cert.name}</h3>
                    <p className="text-sm text-neutral-500">
                      {cert.issuedBy} &bull; Valid until {format(parseISO(cert.validUntil), 'MMM yyyy')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Recent Batches */}
      {farmer.recentBatches.length > 0 && (
        <section className="mt-10 px-6">
          <div className="mx-auto max-w-lg">
            <h2 className="mb-4 text-lg font-semibold text-neutral-900">Recent Batches</h2>
            <div className="space-y-3">
              {farmer.recentBatches.map((batch) => (
                <Link
                  key={batch.id}
                  href={`/t/${batch.shortCode}`}
                  className="card flex items-center gap-4 p-4 transition hover:shadow-md"
                >
                  <div className="flex-1">
                    <h3 className="font-medium text-neutral-900">{batch.product}</h3>
                    <p className="text-sm text-neutral-500">
                      Harvested {format(parseISO(batch.harvestDate), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <span className={`badge ${
                    batch.status === 'DELIVERED' ? 'badge-verified' :
                    batch.status === 'IN_TRANSIT' ? 'badge-info' :
                    'badge-warning'
                  }`}>
                    {batch.status.toLowerCase().replace('_', ' ')}
                  </span>
                  <ChevronRight className="h-5 w-5 text-neutral-400" />
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Member Since */}
      <section className="mt-10 px-6">
        <div className="mx-auto max-w-lg text-center text-sm text-neutral-500">
          <p>AgroBridge member since {format(parseISO(farmer.memberSince), 'MMMM yyyy')}</p>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="mt-16 px-6">
        <div className="mx-auto max-w-lg text-center">
          <div className="card p-6">
            <p className="mb-4 text-sm text-neutral-600">
              Interested in sourcing from verified farmers like {farmer.name.split(' ')[0]}?
            </p>
            <a
              href="https://agrobridge.io?ref=farmer-profile"
              className="inline-flex items-center justify-center rounded-full bg-earth-600 px-6 py-3 font-medium text-white transition hover:bg-earth-700"
            >
              Connect with AgroBridge
            </a>
          </div>
        </div>
      </section>

      {/* Powered By */}
      <footer className="mt-12 text-center text-sm text-neutral-400">
        Powered by AgroBridge Traceability
      </footer>
    </main>
  );
}
