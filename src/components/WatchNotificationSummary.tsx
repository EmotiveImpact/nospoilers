type Destination = {
  id: number;
  kind: string;
  host: string;
  lastDeliveryStatus: string | null;
};

type Route = {
  id: number;
  minSeverity: string;
  repoFullName: string | null;
  packageName: string | null;
  teamLogin: string | null;
};

export function WatchNotificationSummary({
  destinations,
  routes,
}: {
  destinations: Destination[];
  routes: Route[];
}) {
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <section className="rounded-lg border border-white/8 bg-panel p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm text-snow">Destinations</h2>
          <span className="text-xs text-dim">{destinations.length}</span>
        </div>
        {destinations.length === 0 ? (
          <p className="mt-4 text-sm text-mute">No destinations connected.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {destinations.map((destination) => (
              <li key={destination.id} className="flex items-baseline justify-between gap-3">
                <div>
                  <p className="text-sm text-snow">{destination.kind}</p>
                  <p className="mt-1 font-mono text-xs text-dim">{destination.host}</p>
                </div>
                <span className="text-xs uppercase tracking-[0.16em] text-dim">
                  {destination.lastDeliveryStatus ?? "not tested"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-white/8 bg-panel p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm text-snow">Routes</h2>
          <span className="text-xs text-dim">{routes.length}</span>
        </div>
        {routes.length === 0 ? (
          <p className="mt-4 text-sm text-mute">No custom routes. Alerts use connected defaults.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {routes.map((route) => (
              <li key={route.id}>
                <p className="text-sm text-snow">{route.minSeverity} severity</p>
                <p className="mt-1 truncate text-xs text-dim">
                  {route.repoFullName ?? route.packageName ?? route.teamLogin ?? "All sources"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
