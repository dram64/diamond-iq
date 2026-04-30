import { NavLink, Outlet } from 'react-router-dom';
import { DIQLogo } from './primitives/DIQLogo';

const navLinks = [
  { to: '/',                label: 'Today',         end: true  },
  { to: '/live/g1',         label: 'Live',          end: false },
  { to: '/compare-players', label: 'Compare',       end: false },
  { to: '/teams',           label: 'Teams',         end: false },
  { to: '/stats',           label: 'Stat Explorer', end: false },
] as const;

export function RootLayout() {
  return (
    <div className="min-h-screen bg-surface-2 text-paper-2">
      <header className="sticky top-0 z-20 border-b border-hairline-strong bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-page items-center gap-10 px-7 py-3.5">
          <NavLink to="/" aria-label="Diamond IQ home">
            <DIQLogo size={22} />
          </NavLink>
          <nav className="flex flex-1 gap-6 text-[13px] font-medium">
            {navLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  [
                    'border-b-2 pb-0.5 transition-colors',
                    isActive
                      ? 'border-accent text-accent'
                      : 'border-transparent text-paper-3 hover:text-paper-2',
                  ].join(' ')
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <SearchBox />
        </div>
      </header>

      <main className="mx-auto max-w-page px-6 pt-7 pb-[72px]">
        <Outlet />
      </main>

      <SiteFooter />
    </div>
  );
}

function SearchBox() {
  return (
    <label className="flex w-[240px] items-center gap-2 rounded-m border border-hairline-strong bg-surface-2 px-2.5 py-1.5">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        placeholder="Search players, teams, stats"
        className="flex-1 border-0 bg-transparent text-[12px] text-paper-2 outline-none placeholder:text-paper-4"
      />
      <span className="mono text-[10px] text-paper-5">⌘K</span>
    </label>
  );
}

function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-hairline px-7 pb-12 pt-9">
      <div className="mx-auto flex max-w-page flex-wrap items-start justify-between gap-10">
        <div className="flex max-w-[360px] flex-col gap-2">
          <DIQLogo size={18} />
          <p className="m-0 text-[13px] leading-relaxed text-paper-4">
            Baseball analytics, live game data, and plain-English insights — for
            people who actually watch the game.
          </p>
        </div>
        <div className="flex gap-14 text-[11px] text-paper-4">
          <FooterCol
            title="Product"
            items={['Today', 'Live tracker', 'Stat Explorer', 'Compare', 'Teams']}
          />
          <FooterCol
            title="Data"
            items={['Methodology', 'Glossary', 'Historical', 'API access']}
          />
          <FooterCol
            title="About"
            items={['Team', 'Careers', 'Contact', 'Press']}
          />
        </div>
      </div>
      <div className="mx-auto mt-8 flex max-w-page justify-between border-t border-hairline pt-5 font-mono text-[10.5px] text-paper-5">
        <span>© 2026 Diamond IQ</span>
        <span>Live MLB data · v4.14</span>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  items,
}: {
  title: string;
  items: readonly string[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="kicker text-[9.5px] text-paper-3">{title}</span>
      {items.map((i) => (
        <a
          key={i}
          href="#"
          className="text-[12px] text-paper-4 hover:text-paper-2"
        >
          {i}
        </a>
      ))}
    </div>
  );
}
