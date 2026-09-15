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
import {WorkspaceTokens} from './WorkspaceTokens';
import {WorkspaceNotifications} from './WorkspaceNotifications';
import { ReleasesScreen } from "@/components/watch/screens/ReleasesScreen";
import { SetupScreen } from "@/components/watch/screens/SetupScreen";
import { ScanPage } from "@/pages/ScanPage";
import {WorkspaceManagement} from './WorkspaceManagement';
import {WorkspaceTeam} from './WorkspaceTeam';
import {WorkspaceWebsiteSources} from './WorkspaceWebsiteSources';
import {WorkspaceAlerts} from './WorkspaceAlerts';
import {WorkspaceScanPolicy} from './WorkspaceScanPolicy';

export function WatchRouteContent({ context }: { context: WatchScreenContext }) {
  const workspaceId=new URLSearchParams(context.search).get('workspace');
  return (
    <WatchScreenProvider value={context}>
      {context.route.view==='workspaces'?<WorkspaceManagement/>:null}
      <OverviewScreen />
      {context.route.view === "scan" ? <ScanPage search={context.search} embedded /> : null}
      {context.route.view==='alerts'&&workspaceId?<WorkspaceAlerts workspaceId={workspaceId} search={context.search}/>:<AlertsScreen />}
      <SourcesScreen />
      <WorkspaceWebsiteSources />
      <SetupScreen />
      <TimelineRouteScreen />
      <RetentionRouteScreen />
      {context.route.view==='policy'&&workspaceId?<WorkspaceScanPolicy workspaceId={workspaceId} connectionPanels={{signing:<PolicyScreen section="signing"/>,allowlist:<PolicyScreen section="allowlist"/>}}/>:<PolicyScreen />}
      <AuditRouteScreen />
      {context.route.view==='team'&&workspaceId?<WorkspaceTeam workspaceId={workspaceId}/>:<TeamScreen />}
      <HealthScreen />
      {context.route.view==='notifications'&&workspaceId?<WorkspaceNotifications workspaceId={workspaceId} connectionSettings={<NotificationsScreen embedded/>}/>:<NotificationsScreen />}
      <SourcesProductionScreens />
      <RegistriesScreen />
      {context.route.view==='tokens'&&workspaceId?<WorkspaceTokens workspaceId={workspaceId}/>:<TokensScreen />}
      <ReleasesScreen />
    </WatchScreenProvider>
  );
}
