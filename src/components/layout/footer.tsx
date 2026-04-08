import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
                <span className="text-white font-bold text-xs">HN</span>
              </div>
              <span className="text-sm font-semibold text-foreground">
                Hubs Network
              </span>
            </div>
            <p className="text-sm text-muted leading-relaxed max-w-xs">
              Mapping and connecting hubs, pilgrims and patrons for a
              regenerative residencies ecosystem.
            </p>
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
                <span className="text-sm text-muted-light">
                  Pilgrims — coming soon
                </span>
              </li>
              <li>
                <span className="text-sm text-muted-light">
                  Patrons — coming soon
                </span>
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
