import { NavLink, Outlet } from "react-router-dom";
import { Layers, Plus, Shirt, Sun, User } from "lucide-react";
import { cn } from "../lib/utils";

const tabs = [
  { to: "/", label: "Bugün", icon: Sun, end: true },
  { to: "/wardrobe", label: "Gardırop", icon: Shirt },
  { to: "/add", label: "Ekle", icon: Plus, primary: true },
  { to: "/outfits", label: "Kombinler", icon: Layers },
  { to: "/profile", label: "Profil", icon: User },
];

export function Layout() {
  return (
    <div className="mx-auto min-h-full max-w-2xl pb-24">
      <main className="pt-safe">
        <Outlet />
      </main>
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-paper/90 backdrop-blur" aria-label="Ana menü">
        <div className="mx-auto flex max-w-2xl items-center justify-around px-2 pt-2">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                cn(
                  "flex min-w-14 flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-[11px]",
                  t.primary ? "text-ink" : isActive ? "text-ink" : "text-stone-400",
                )
              }
            >
              {({ isActive }) =>
                t.primary ? (
                  <span className="-mt-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-paper shadow-lg">
                    <t.icon className="h-6 w-6" />
                  </span>
                ) : (
                  <>
                    <t.icon className={cn("h-6 w-6", isActive && "stroke-[2.25]")} />
                    {t.label}
                  </>
                )
              }
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
