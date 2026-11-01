import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { Layout } from "./components/Layout";
import { PageLoader } from "./components/ui";
import { Landing } from "./pages/Landing";
import { Login, Register, ForgotPassword, ResetPassword, VerifyEmail } from "./pages/Auth";
import { Today } from "./pages/Today";
import { Wardrobe } from "./pages/Wardrobe";

// Daha az kullanılan / ağır sayfalar ayrı paketlerde
const AddItems = lazy(() => import("./pages/AddItems"));
const ItemDetail = lazy(() => import("./pages/ItemDetail"));
const Outfits = lazy(() => import("./pages/Outfits"));
const Stylist = lazy(() => import("./pages/Stylist"));
const Stats = lazy(() => import("./pages/Stats"));
const Packing = lazy(() => import("./pages/Packing"));
const Profile = lazy(() => import("./pages/Profile"));
const Billing = lazy(() => import("./pages/Billing"));

function Private({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/welcome" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/welcome" element={<PublicOnly><Landing /></PublicOnly>} />
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route element={<Private><Layout /></Private>}>
          <Route index element={<Today />} />
          <Route path="wardrobe" element={<Wardrobe />} />
          <Route path="items/:id" element={<ItemDetail />} />
          <Route path="add" element={<AddItems />} />
          <Route path="outfits" element={<Outfits />} />
          <Route path="stylist" element={<Stylist />} />
          <Route path="stats" element={<Stats />} />
          <Route path="packing" element={<Packing />} />
          <Route path="profile" element={<Profile />} />
          <Route path="settings/billing" element={<Billing />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
