import Link from "next/link";
import Image from "next/image";

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="mb-3">
              <Image
                src="/HubNetwork_full.png"
                alt="Hubs Network"
                width={160}
                height={40}
                className="h-10 w-auto"
                style={{ width: "auto", height: "auto" }}
              />
            </div>
            <p className="text-sm text-muted leading-relaxed max-w-xs">
              Mapping and connecting hubs, pilgrims and patrons for a
              regenerative residencies ecosystem.
            </p>

            <div className="mt-5 flex items-center gap-3">
              <a
                href="https://hubsnetwork.org"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Hubs Network website"
                title="hubsnetwork.org"
                className="flex items-center justify-center w-10 h-10 rounded-full border border-border bg-surface hover:border-primary/40 transition-colors"
              >
                <Image
                  src="/HN-blu.svg"
                  alt="Hubs Network"
                  width={22}
                  height={22}
                  className="w-[22px] h-[22px] rounded"
                />
              </a>
              <a
                href="https://t.me/+ZfW1f3OQWgozNmEy"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Hubs Network Telegram group"
                title="Telegram group"
                className="flex items-center justify-center w-10 h-10 rounded-full border border-border bg-surface hover:border-primary/40 transition-colors"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-[22px] h-[22px]"
                  fill="#229ED9"
                  aria-hidden="true"
                >
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">
              Platform
            </h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/hubs"
                  className="text-sm text-muted hover:text-foreground transition-colors"
                >
                  Browse Hubs
                </Link>
              </li>
              <li>
                <Link
                  href="/register/hub"
                  className="text-sm text-muted hover:text-foreground transition-colors"
                >
                  Register a Hub
                </Link>
              </li>
              <li>
                <Link
                  href="/pilgrims"
                  className="text-sm text-muted hover:text-foreground transition-colors"
                >
                  Pilgrims
                </Link>
              </li>
              <li>
                <Link
                  href="/patrons"
                  className="text-sm text-muted hover:text-foreground transition-colors"
                >
                  Patrons
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">
              About
            </h4>
            <p className="text-sm text-muted leading-relaxed">
              Residencies by Hubs Network is an open platform for mapping hub
              capabilities, needs and networks. All data is transparent and
              stored as open JSON.
            </p>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border-light text-center">
          <p className="text-xs text-muted-light">
            &copy; {new Date().getFullYear()} Hubs Network. Data is open and
            stored in the project repository.
          </p>
        </div>
      </div>
    </footer>
  );
}
