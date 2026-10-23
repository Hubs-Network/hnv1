import Image from "next/image";
import type { Metadata } from "next";
import {
  BadgeCheck,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { getPublishedPilgrims } from "@/lib/data/pilgrims";
import { getApprovedHubs } from "@/lib/data/hubs";
import { PilgrimCard } from "@/components/passport/pilgrim-card";
import {
  ClaimHubPicker,
  type ClaimHubItem,
} from "@/components/passport/claim-hub-picker";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Become a Pilgrim — Hubs Network",
  description:
    "Pilgrims move through the Hubs Network to contribute skills, solve real problems and take part in residencies. Claim your on-chain Pilgrim Passport.",
};

const WHY_POINTS = [
  "Apply for residencies hosted by Hubs.",
  "Demonstrate skills verified by trusted organizations.",
  "Build a reputation through real-world contributions.",
  "Keep a portable record of your verified skills.",
  "Connect with Hubs looking for your expertise.",
];

const STEPS: { title: string; desc: string }[] = [
  {
    title: "Choose a Hub.",
    desc: "Select a participating organization that knows your work or can evaluate your skills.",
  },
  {
    title: "Select your skills.",
    desc: "Choose up to 10 skills you would like the Hub to verify.",
  },
  {
    title: "Submit your request.",
    desc: "Confirm your application using your digital wallet, which acts as your secure digital identity.",
  },
  {
    title: "Wait for verification.",
    desc: "The Hub reviews your request and decides which skills it can confirm.",
  },
  {
    title: "Receive your Passport.",
    desc: "Once approved, your Passport is created and linked to your wallet.",
  },
  {
    title: "Start building your reputation.",
    desc: "Your verified skills become visible across the Hubs Network.",
  },
];

export default async function PilgrimsPage() {
  const [pilgrims, approvedHubs] = await Promise.all([
    getPublishedPilgrims(),
    getApprovedHubs(),
  ]);

  const claimHubs: ClaimHubItem[] = approvedHubs.map((h) => ({
    id: h.hub_id || h.safeAddress || "",
    name: h.name,
    city: h.location?.city,
    country: h.location?.country,
  }));

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
              <div className="mt-8">
                <ClaimHubPicker hubs={claimHubs} />
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

      {/* Published pilgrims directory */}
      {pilgrims.length > 0 && (
        <section className="border-b border-border bg-stone-50/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
            <div className="flex items-center gap-2 mb-2">
              <BadgeCheck className="w-5 h-5 text-primary" />
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                Meet the Pilgrims
              </h2>
            </div>
            <p className="text-sm sm:text-base text-muted mb-8">
              Pilgrims who published their passport and skills.
            </p>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {pilgrims.map((p) => (
                <PilgrimCard key={p.wallet} pilgrim={p} />
              ))}
            </div>
          </div>
        </section>
      )}

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
                The Pilgrim Passport is your{" "}
                <strong className="text-foreground font-medium">
                  digital skills passport
                </strong>{" "}
                within the Hubs Network.
              </p>
              <p>
                It allows you to showcase skills that have been verified by
                participating organizations, called{" "}
                <strong className="text-foreground font-medium">Hubs</strong>.
              </p>
              <p>
                Unlike a traditional online profile, where anyone can list their
                own abilities, your Passport contains skills that a Hub has
                reviewed and approved.
              </p>
              <p>
                Your Passport is stored on a blockchain, making it{" "}
                <strong className="text-foreground font-medium">
                  verifiable, permanent, and independent of any single platform
                </strong>
                . It belongs to you and cannot be transferred to someone else.
              </p>
            </div>
          </div>

          {/* Why get a Passport */}
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-3">
              Why get a Passport?
            </h2>
            <p className="text-sm sm:text-base text-muted leading-relaxed mb-4">
              Your Passport helps Hubs discover what you can offer and creates
              new opportunities for collaboration.
            </p>
            <p className="text-sm sm:text-base text-muted leading-relaxed mb-4">
              With your Passport, you can:
            </p>
            <ul className="space-y-2 mb-6">
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
            <div className="rounded-xl border border-border bg-stone-50/50 p-5">
              <p className="text-sm sm:text-base text-foreground font-medium mb-1.5">
                What is a residency?
              </p>
              <p className="text-sm sm:text-base text-muted leading-relaxed">
                A residency is a short-term collaboration where a travelling
                professional, creative, or volunteer (a{" "}
                <em>Pilgrim</em>) works with a local organization (a{" "}
                <em>Hub</em>) to address real challenges. These can be technical,
                cultural, social, environmental, or organizational.
              </p>
            </div>
          </div>

          {/* How does it work */}
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-3">
              How does it work?
            </h2>
            <p className="text-sm sm:text-base text-muted leading-relaxed mb-5">
              Getting your Passport takes just a few steps:
            </p>
            <ol className="space-y-4">
              {STEPS.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-7 h-7 shrink-0 rounded-full bg-primary text-white text-sm font-semibold">
                    {i + 1}
                  </span>
                  <span className="text-sm sm:text-base text-muted leading-relaxed pt-0.5">
                    <strong className="text-foreground font-medium">
                      {step.title}
                    </strong>{" "}
                    {step.desc}
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary-bg p-5">
              <Wallet className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-foreground leading-relaxed">
                <strong>It&apos;s free to claim.</strong> You don&apos;t need to
                purchase cryptocurrency or pay blockchain transaction fees. The
                Hubs Network handles the technical process for you.
              </p>
            </div>
          </div>

          {/* Good to know */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                Good to know
              </h2>
            </div>
            <div className="space-y-4 text-sm sm:text-base text-muted leading-relaxed">
              <p>
                <strong className="text-foreground font-medium">
                  Skills must be verified.
                </strong>{" "}
                Selecting a skill doesn&apos;t mean it is automatically
                certified. The Hub may approve all your proposed skills or only
                some of them.
              </p>
              <p>
                <strong className="text-foreground font-medium">
                  One Passport per wallet.
                </strong>{" "}
                Each digital wallet can hold one Pilgrim Passport.
              </p>
              <p>
                <strong className="text-foreground font-medium">
                  Your Passport stays with you.
                </strong>{" "}
                It cannot be sold or transferred to another person, and its
                verified skills can be checked independently on the blockchain.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
