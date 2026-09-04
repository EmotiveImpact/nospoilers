# Electron installer scanning — intentionally on ice

Product status: [`docs/STATUS.md`](STATUS.md). Do not start this worker until paying demand.

NoSpoilers currently scans an `app.asar` directly. It does **not** claim to unpack `.dmg`, `.exe`,
`.msi`, `.AppImage`, or platform application bundles.

The normal worker classifies those names (including electron-builder `*-mac.zip` /
`*-win.zip` / `*-darwin-*.zip` desktop bundles) and skips them. It writes a Watch
alert, does not download, and does not mint an inconclusive receipt. A later
`release.edited` that only changes installer assets does not enqueue another
heavy scan. A Release that also has a scannable pack (`.tgz`, a zip that is not
a desktop installer, …) still scans that pack and notes the skipped installers.

Those inputs are usually 150–300 MB and can expand into several gigabytes. They also require
platform-specific parsers. Running them inside the API or the normal queue worker would let an
untrusted installer consume customer capacity, memory, or disk.

## Worker shape when we build it

Use a one-shot isolated container job, not a larger always-on web server:

1. The normal worker validates the source URL, declared size, and content type.
2. It starts one ephemeral job for one artifact.
3. The job streams the installer to temporary disk.
4. Network access is disabled after download.
5. The job extracts only enough to locate `app.asar` and relevant resources.
6. The existing scanner kernel scans those packed bytes.
7. Only finding metadata returns to Postgres.
8. The entire container and temporary disk are destroyed.

Initial job limits:

- 4–8 GB RAM
- 10 GB ephemeral disk
- 2 vCPU
- one installer per job
- 5 minute hard timeout
- 300 MB compressed input
- 3 GB extracted bytes
- 100,000 entries
- no root, no shell execution, no installer execution

Cloud Run Jobs is a good fit when this becomes real because each task is disposable and can have a
separate ephemeral disk. A dedicated Railway worker is acceptable for a prototype, but it must
launch scans in restricted child containers; merely adding RAM to the current Node process is not
isolation.

## Format order

When demand justifies the work:

1. `.dmg` containing a macOS `.app` and `Contents/Resources/app.asar`
2. Windows `.exe` / NSIS packages containing `resources/app.asar`
3. `.AppImage`
4. `.msi`

Do not advertise these formats until each has real fixtures, hostile-archive tests, and a deployed
resource-limited worker.
