import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { useAuthStore } from "@/lib/store";
import { ThemeProvider } from "@/lib/theme";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";

// Pages
import Home from "@/pages/home";
import Dashboard from "@/pages/dashboard";
import Market from "@/pages/market";
import MarketNew from "@/pages/market-new";
import MarketDetail from "@/pages/market-detail";
import Transactions from "@/pages/transactions";
import TransactionDetail from "@/pages/transaction-detail";
import Topup from "@/pages/topup";
import Withdraw from "@/pages/withdraw";
import Profile from "@/pages/profile";
import Terms from "@/pages/terms";
import Privacy from "@/pages/privacy";
import RefundPolicy from "@/pages/refund-policy";
import HowItWorks from "@/pages/how-it-works";
import Contact from "@/pages/contact";
import Banned from "@/pages/banned";
import Logs from "@/pages/logs";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        const status = error?.status ?? error?.response?.status;
        if (status === 401 || status === 403 || status === 429) return false;
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component, ...rest }: any) {
  const { user, _hasHydrated } = useAuthStore();

  return (
    <Route {...rest}>
      {(params) =>
        !_hasHydrated ? null : user ? (
          <Component {...params} />
        ) : (
          <div className="p-20 text-center font-bold text-slate-500">
            Silakan login untuk mengakses halaman ini.
          </div>
        )
      }
    </Route>
  );
}

function TokenCapture() {
  const { token, user, setToken, setAuth, logout, _hasHydrated } = useAuthStore();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    const authError = params.get("auth_error");

    if (urlToken) {
      setToken(urlToken);
      const url = new URL(window.location.href);
      url.searchParams.delete("token");
      window.history.replaceState({}, "", url.toString());
    }

    if (authError) {
      toast({
        title: "Login Gagal",
        description: decodeURIComponent(authError),
        variant: "destructive",
        duration: 8000,
      });
      const url = new URL(window.location.href);
      url.searchParams.delete("auth_error");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const { data: me, isError: meError } = useGetMe({
    request: token ? { headers: { "X-Auth-Token": token } } : undefined,
    query: {
      enabled: _hasHydrated && !!token,
      staleTime: 5 * 60 * 1000,
      retry: false,
    },
  });

  useEffect(() => {
    if (!_hasHydrated) return;
    if (me && token) {
      setAuth(token, me);
      if (!user) setLocation("/dashboard");
    }
  }, [me, token, _hasHydrated]);

  useEffect(() => {
    if (!_hasHydrated) return;
    if (meError && token) {
      logout();
    }
  }, [meError, token, _hasHydrated]);

  return null;
}

function Router() {
  return (
    <Layout>
      <TokenCapture />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/market" component={Market} />
        <ProtectedRoute path="/market/new" component={MarketNew} />
        <Route path="/market/:id" component={MarketDetail} />
        <ProtectedRoute path="/dashboard" component={Dashboard} />
        <ProtectedRoute path="/transactions" component={Transactions} />
        <ProtectedRoute path="/transaction/:id" component={TransactionDetail} />
        <ProtectedRoute path="/topup" component={Topup} />
        <ProtectedRoute path="/withdraw" component={Withdraw} />
        <ProtectedRoute path="/profile" component={Profile} />
        <Route path="/terms" component={Terms} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/refund-policy" component={RefundPolicy} />
        <Route path="/cara-kerja" component={HowItWorks} />
        <Route path="/contact" component={Contact} />
        <Route path="/banned" component={Banned} />
        <ProtectedRoute path="/logs" component={Logs} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <HelmetProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </HelmetProvider>
  );
}

export default App;
