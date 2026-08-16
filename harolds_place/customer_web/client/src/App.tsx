// Design reminder: Quiet Maroon Hospitality — the app is a customer ordering desk, not a generic restaurant marketing template.
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OrderingProvider } from "@/contexts/OrderingContext";
import Account from "@/pages/Account";
import Cart from "@/pages/Cart";
import Checkout from "@/pages/Checkout";
import Home from "@/pages/Home";
import Menu from "@/pages/Menu";
import NotFound from "@/pages/NotFound";
import RestaurantInfo from "@/pages/RestaurantInfo";
import Track from "@/pages/Track";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

function Router() {
  return (
    <Switch>
      <Route component={Home} path="/" />
      <Route component={Menu} path="/menu" />
      <Route component={Cart} path="/cart" />
      <Route component={Checkout} path="/checkout" />
      <Route component={Track} path="/track" />
      <Route component={Account} path="/account" />
      <Route component={RestaurantInfo} path="/restaurant" />
      <Route component={NotFound} path="/404" />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <OrderingProvider>
            <Toaster position="top-center" richColors />
            <Router />
          </OrderingProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
