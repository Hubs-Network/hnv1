import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import {
  ArrowRight,
  BadgeCheck,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Become a Pilgrim — Hubs Network",
  description:
    "Pilgrims move through the Hubs Network to contribute skills, solve real problems and take part in residencies. Claim your on-chain Pilgrim Passport.",
};

const WHY_POINTS = [
  "apply for future residencies",
  "show skills attested by real Hubs",
  "build reputation across the Hubs Network",
  "make your contribution history portable",
  "help Hubs match you with real challenges",
];

const STEPS = [
  "Choose an approved Hub.",
  "Select up to 10 skills you want to propose.",
  "Sign a claim request with your wallet.",
  "The Hub reviews your proposed skills.",
  "If a Hub owner approves your claim, your Passport is minted.",
  "Your approved skills become visible as Hub-attested skills.",
];

export default function PilgrimsPage() {
  return (
    <div>
      {/* Intro + pilgrim samples */}
      <section className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-bg text-primary text-xs font-medium mb-6">
                <Sparkles className="w-3.5 h-3.5" />
                Pilgrim Passport
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-tight leading-[1.1]">
                Become a Pilgrim
              </h1>
              <p className="mt-6 text-base sm:text-lg text-muted leading-relaxed">
                Pilgrims are people who move through the Hubs Network to
                contribute skills, solve real problems, and take part in
                residencies hosted by local hubs.
              </p>
              <p className="mt-4 text-sm sm:text-base text-muted leading-relaxed">
                A Pilgrim can be a developer, designer, artist, researcher,
                organizer, maker, strategist, educator, or any other kind of
                contributor willing to work with a hub on a concrete challenge.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/hubs">
                  <Button size="lg">
                    Claim your Passport
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/hubs">
                  <Button variant="secondary" size="lg">
                    Browse Hubs
                  </Button>
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:gap-6 max-w-md mx-auto lg:max-w-none w-full">
              {[
                { src: "/pilgrimFemale.png", alt: "Pilgrim" },
                { src: "/pilgrimMale.png", alt: "Pilgrim" },
              ].map((img, i) => (
                <div
                  key={img.src}
                  className={`relative aspect-square rounded-2xl overflow-hidden bg-primary-bg border border-border ${
                    i === 1 ? "mt-6 sm:mt-10" : ""
                  }`}
                >
                  <Image
                    src={img.src}
                    alt={img.alt}
                    fill
                    sizes="(max-width: 1024px) 45vw, 25vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Body */}
      <section>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 space-y-14">
          {/* What is a Pilgrim Passport */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BadgeCheck className="w-5 h-5 text-primary" />
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                What is a Pilgrim Passport?
              </h2>
            </div>
            <div className="space-y-4 text-sm sm:text-base text-muted leading-relaxed">
              <p>
                The Pilgrim Passport is your on-chain skills passport for the
                Hubs Network.
              </p>
              <p>
                It is a non-transferable credential connected to your wallet. It
                shows the skills that have been reviewed and attested by
                approved Hubs.
              </p>
              <p>
                Your Passport is not a self-declared profile. You can propose
                your skills, but a Hub must approve and mint your Passport
                before those skills become attested.
              </p>
            </div>
          </div>

          {/* Why claim a Passport */}
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-3">
              Why claim a Passport?
            </h2>
            <p className="text-sm sm:text-base text-muted leading-relaxed mb-4">
              Your Passport helps Hubs understand what you can contribute. It
              can be used to:
            </p>
            <ul className="space-y-2 mb-4">
              {WHY_POINTS.map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-2.5 text-sm sm:text-base text-muted"
                >
                  <BadgeCheck className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm sm:text-base text-muted leading-relaxed">
              Residencies are short working experiences hosted by Hubs. During a
              residency, Pilgrims collaborate with a local Hub on technical,
              cultural, social, environmental, or organizational challenges.
            </p>
          </div>

          {/* How claiming works */}
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-5">
              How claiming works
            </h2>
            <ol className="space-y-4">
              {STEPS.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-7 h-7 shrink-0 rounded-full bg-primary text-white text-sm font-semibold">
                    {i + 1}
                  </span>
                  <span className="text-sm sm:text-base text-foreground leading-relaxed pt-0.5">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary-bg p-5">
              <Wallet className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-foreground leading-relaxed">
                The claim is <strong>gasless</strong> for you. You only sign
                messages; the Hubs Network relayer submits the on-chain
                transactions.
              </p>
            </div>
          </div>

          {/* Important */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                Important
              </h2>
            </div>
            <div className="space-y-4 text-sm sm:text-base text-muted leading-relaxed">
              <p>Selecting a skill does not automatically certify it.</p>
              <p>
                Your proposed skills become part of your Passport only after the
                Hub approves and mints them. The Hub may approve all selected
                skills or only a subset.
              </p>
              <p className="text-foreground font-medium">
                Each wallet can hold one Pilgrim Passport.
              </p>
            </div>
          </div>

          <div className="pt-2">
            <Link href="/hubs">
              <Button size="lg">
                Choose a Hub to start
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
