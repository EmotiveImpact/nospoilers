import { WatchScreenProvider, type WatchScreenContext } from "@/components/watch/WatchScreenContext";
import { OverviewScreen } from "@/components/watch/screens/OverviewScreen";
import { SourcesScreen } from "@/components/watch/screens/SourcesScreen";
import { AlertsScreen } from "@/components/watch/screens/AlertsScreen";
import { TimelineRouteScreen } from "@/components/watch/screens/TimelineRouteScreen";
import { RetentionRouteScreen } from "@/components/watch/screens/RetentionRouteScreen";
import { PolicyScreen } from "@/components/watch/screens/PolicyScreen";
import { AuditRouteScreen } from "@/components/watch/screens/AuditRouteScreen";
import { TeamScreen } from "@/components/watch/screens/TeamScreen";
import { HealthScreen } from "@/components/watch/screens/HealthScreen";
import { NotificationsScreen } from "@/components/watch/screens/NotificationsScreen";
import { SourcesProductionScreens } from "@/components/watch/screens/SourcesProductionScreens";
import { RegistriesScreen } from "@/components/watch/screens/RegistriesScreen";
import { TokensScreen } from "@/components/watch/screens/TokensScreen";
import { ReleasesScreen } from "@/components/watch/screens/ReleasesScreen";
import { SetupScreen } from "@/components/watch/screens/SetupScreen";

export function WatchRouteContent({ context }: { context: WatchScreenContext }) {
  return (
    <WatchScreenProvider value={context}>
      <OverviewScreen />
      <AlertsScreen />
      <SourcesScreen />
      <SetupScreen />
      <TimelineRouteScreen />
      <RetentionRouteScreen />
      <PolicyScreen />
      <AuditRouteScreen />
      <TeamScreen />
      <HealthScreen />
      <NotificationsScreen />
      <SourcesProductionScreens />
      <RegistriesScreen />
      <TokensScreen />
      <ReleasesScreen />
    </WatchScreenProvider>
  );
}
