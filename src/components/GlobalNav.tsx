import { useLocation, useNavigate } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";

const routes: Array<{ label: string; path: string }> = [
  { label: "Reservations", path: "/dashboard" },
  { label: "Listings", path: "/listings" },
  { label: "Wishlist", path: "/wishlist" },
  { label: "Messages", path: "/messages" },
  { label: "Profile", path: "/profile" },
];

const GlobalNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, profile } = useAuth();
  const isHost = profile?.user_role === "host";

  const handleListingScopeNavigate = (scope: "all" | "mine", options?: { edit?: boolean }) => {
    navigate("/listings", {
      state: {
        listingScope: scope,
        triggerEdit: options?.edit ?? false,
      },
    });
  };

  if (location.pathname === "/auth" || location.pathname === "/" || location.pathname === "/about") {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-40 flex flex-col items-end gap-3">
      <div className="pointer-events-auto flex flex-wrap justify-end gap-2">
        {routes.map((route) => (
          route.path === "/listings" && isHost ? (
            <DropdownMenu key={`${route.path}-dropdown`}>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant={location.pathname.startsWith(route.path) ? "default" : "outline"}
                  className="rounded-full border-white/70 bg-white/90 text-slate-700 shadow"
                >
                  Listings
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[10rem]">
                <DropdownMenuItem onSelect={() => handleListingScopeNavigate("all")}>All listings</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleListingScopeNavigate("mine")}>
                  Edit my listing
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              key={route.path}
              size="sm"
              variant={location.pathname.startsWith(route.path) ? "default" : "outline"}
              className="rounded-full border-white/70 bg-white/90 text-slate-700 shadow"
              onClick={() => navigate(route.path)}
            >
              {route.label}
            </Button>
          )
        ))}
      </div>
      <Button
        onClick={() => signOut()}
        variant="destructive"
        size="sm"
        className="pointer-events-auto rounded-full bg-red-600 text-white shadow hover:bg-red-500"
      >
        Sign out
      </Button>
    </div>
  );
};

export default GlobalNav;
