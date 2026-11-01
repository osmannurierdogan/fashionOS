import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { UserDTO } from "@fashionos/shared";
import { api } from "./api";

interface AuthCtx {
  user: UserDTO | null;
  loading: boolean;
  refresh: () => Promise<unknown>;
  setUser: (u: UserDTO | null) => void;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>(null as never);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<{ user: UserDTO | null }>("/api/auth/me").then((r) => r.user),
    staleTime: 60_000,
  });
  const value: AuthCtx = {
    user: q.data ?? null,
    loading: q.isLoading,
    refresh: () => q.refetch(),
    setUser: (u) => qc.setQueryData(["me"], u),
    logout: async () => {
      await api.post("/api/auth/logout");
      qc.clear();
      qc.setQueryData(["me"], null);
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
