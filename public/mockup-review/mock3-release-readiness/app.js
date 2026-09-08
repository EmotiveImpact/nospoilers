const state = {
  selectedStep: "assets",
  acknowledged: false,
  resolved: false,
};

const stepData = {
  artifact: {
    eyebrow: "Artifact evidence",
    title: "Package artifact contains only intended files",
    description: "The packed npm tarball was unpacked and inspected. No original application source, local credentials, or untracked build output was found.",
    label: "Scanned artifact",
    path: "nospoilers-0.1.0.tgz",
    severity: "Clean",
    icon: "solar:check-circle-linear",
  },
  github: {
    eyebrow: "Visibility evidence",
    title: "Repository and release visibility are correct",
    description: "The GitHub repository remains private, release attachments match policy, and no secret-like material is exposed through the connected installation.",
    label: "Repository",
    path: "github.com/EmotiveImpact/nospoilers",
    severity: "Clean",
    icon: "solar:check-circle-linear",
  },
  assets: {
    eyebrow: "Blocking finding",
    title: "Original source is downloadable from production",
    description: "The deployed source map contains sourcesContent, exposing the original TypeScript behind the production bundle.",
    label: "Exposed asset",
    path: "/assets/index-D4yq9.js.map",
    severity: "Critical",
    icon: "solar:shield-warning-linear",
  },
  custody: {
    eyebrow: "Custody verification",
    title: "Custody proof is waiting on remediation",
    description: "NoSpoilers will verify that private maps remain available to your monitoring provider after the public source map has been removed.",
    label: "Expected owner",
    path: "Sentry · EmotiveImpact",
    severity: "Waiting",
    icon: "solar:clock-circle-linear",
  },
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2200);
}

function drawRing(clean = 3, total = 4) {
  const canvas = $("#coverage-ring");
  const ctx = canvas.getContext("2d");
  const center = canvas.width / 2;
  const radius = 58;
  const lineWidth = 10;
  const start = -Math.PI / 2;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "butt";
  ctx.strokeStyle = "#2a2a2e";
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#3fb950";
  ctx.beginPath();
  ctx.arc(center, center, radius, start, start + Math.PI * 2 * (clean / total));
  ctx.stroke();
  if (clean < total) {
    ctx.strokeStyle = "#e2453a";
    ctx.beginPath();
    ctx.arc(center, center, radius, start + Math.PI * 2 * (clean / total), start + Math.PI * 2);
    ctx.stroke();
  }
}

function selectStep(step) {
  state.selectedStep = step;
  const data = stepData[step];
  $$(".proof-row").forEach((row) => row.classList.toggle("selected", row.dataset.step === step));
  $("#finding-eyebrow").textContent = data.eyebrow;
  $("#finding-title").textContent = data.title;
  $("#finding-description").textContent = data.description;
  $("#finding-path span").textContent = data.label;
  $("#finding-path code").textContent = data.path;
  $("#finding-symbol").setAttribute("icon", data.icon);
  const isCritical = data.severity === "Critical" && !state.resolved;
  $("#finding-panel").classList.toggle("is-critical", isCritical);
  $("#acknowledge").hidden = !isCritical;
  $("#resolve").hidden = !isCritical;
  $("#evidence-severity").textContent = state.resolved && step === "assets" ? "Resolved" : data.severity;
  $("#evidence-severity").className = `severity ${isCritical ? "critical" : "clean"}`;
  $("#finding-panel").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function resolveFinding() {
  state.resolved = true;
  document.body.classList.add("resolved");
  $("#verdict-icon").innerHTML = '<iconify-icon icon="solar:shield-check-linear"></iconify-icon>';
  $("#verdict-kicker").textContent = "Release decision";
  $("#verdict-title").textContent = "Ready to release";
  $("#verdict-subtitle").innerHTML = "<strong>All four checks</strong> support a clean receipt.";
  $("#review-finding").innerHTML = 'Open release receipt <iconify-icon icon="solar:arrow-right-linear"></iconify-icon>';
  $("#ring-score").textContent = "4 of 4";
  $("#ring-caption").textContent = "checks clean";
  $("#receipt-status").className = "status-text clean";
  $("#receipt-status").innerHTML = '<iconify-icon icon="solar:verified-check-bold"></iconify-icon>Sealed';
  $("#evidence-severity").textContent = "Resolved";
  $("#evidence-severity").className = "severity clean";
  $("#alert-count").textContent = "0";
  $("#alert-count").style.display = "none";
  const asset = $('.proof-row[data-step="assets"]');
  asset.querySelector(".step-mark").className = "step-mark clean";
  asset.querySelector(".step-mark").innerHTML = '<iconify-icon icon="solar:check-circle-bold"></iconify-icon>';
  asset.querySelector(".step-status").className = "step-status clean";
  asset.querySelector(".step-status").innerHTML = '<iconify-icon icon="solar:check-circle-bold"></iconify-icon>Resolved';
  asset.querySelector(".step-detail").textContent = "Public source map removed and rechecked";
  const custody = $('.proof-row[data-step="custody"]');
  custody.querySelector(".step-mark").className = "step-mark clean";
  custody.querySelector(".step-mark").innerHTML = '<iconify-icon icon="solar:check-circle-bold"></iconify-icon>';
  custody.querySelector(".step-status").className = "step-status clean";
  custody.querySelector(".step-status").innerHTML = '<iconify-icon icon="solar:check-circle-bold"></iconify-icon>Clean';
  custody.querySelector(".step-detail").textContent = "Private map custody verified";
  $("#finding-eyebrow").textContent = "Finding resolved";
  $("#finding-title").textContent = "Production source is no longer exposed";
  $("#finding-description").textContent = "The public source map returned 404 on the latest verification. Private monitoring custody remains intact.";
  $("#finding-symbol").setAttribute("icon", "solar:shield-check-linear");
  $("#acknowledge").hidden = true;
  $("#resolve").hidden = true;
  drawRing(4, 4);
  showToast("Finding resolved. Clean receipt sealed.");
}

function selectRelease(row) {
  $$(".release-row").forEach((item) => item.classList.toggle("selected", item === row));
  $("#release-title").textContent = row.dataset.release;
  $("#evidence-commit").childNodes[0].nodeValue = `${row.dataset.commit} `;
  $("#commit-link").textContent = row.dataset.commit;
  if (row.dataset.status === "sealed") {
    document.body.classList.add("resolved");
    $("#verdict-title").textContent = "Release sealed";
    $("#verdict-subtitle").innerHTML = "<strong>All four checks</strong> were clean when this receipt was issued.";
    $("#ring-score").textContent = "4 of 4";
    $("#receipt-status").className = "status-text clean";
    $("#receipt-status").innerHTML = '<iconify-icon icon="solar:verified-check-bold"></iconify-icon>Sealed';
    drawRing(4, 4);
  } else if (!state.resolved) {
    document.body.classList.remove("resolved");
    $("#verdict-title").textContent = "Hold this release";
    $("#verdict-subtitle").innerHTML = "<strong>1 critical exposure</strong> blocks a clean receipt.";
    $("#ring-score").textContent = "3 of 4";
    $("#receipt-status").className = "status-text critical";
    $("#receipt-status").innerHTML = '<iconify-icon icon="solar:shield-warning-linear"></iconify-icon>Blocked';
    drawRing(3, 4);
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

$("#workspace-switcher").addEventListener("click", () => {
  const menu = $("#workspace-menu");
  menu.hidden = !menu.hidden;
  $("#workspace-switcher").setAttribute("aria-expanded", String(!menu.hidden));
});
$("#menu-button").addEventListener("click", () => $("#app").classList.add("menu-open"));
$("#rail-close").addEventListener("click", () => $("#app").classList.remove("menu-open"));
$$(".nav-link").forEach((link) => link.addEventListener("click", () => $("#app").classList.remove("menu-open")));
$$(".proof-row").forEach((row) => row.addEventListener("click", () => selectStep(row.dataset.step)));
$("#review-finding").addEventListener("click", () => state.resolved ? showToast("Release receipt is ready") : selectStep("assets"));
$("#acknowledge").addEventListener("click", () => {
  state.acknowledged = true;
  $("#acknowledge").textContent = "Acknowledged";
  $("#acknowledge").disabled = true;
  showToast("Finding acknowledged by Augustus");
});
$("#resolve").addEventListener("click", resolveFinding);
$$(".release-row").forEach((row) => row.addEventListener("click", () => selectRelease(row)));
$("#copy-path").addEventListener("click", async () => {
  await navigator.clipboard?.writeText($("#finding-path code").textContent);
  showToast("Asset path copied");
});
$("#copy-brief").addEventListener("click", async () => {
  await navigator.clipboard?.writeText(`${$("#release-title").textContent}: ${$("#verdict-title").textContent}`);
  showToast("Release brief copied");
});
$("#commit-link").addEventListener("click", () => showToast("Commit 14316… selected"));
$("#view-all").addEventListener("click", () => showToast("Release history is already in view"));

function openSearch() {
  $("#search-dialog").hidden = false;
  window.setTimeout(() => $("#search-input").focus(), 0);
}
function closeSearch() { $("#search-dialog").hidden = true; }
$("#search-button").addEventListener("click", openSearch);
$("#dialog-scrim").addEventListener("click", closeSearch);
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); openSearch(); }
  if (event.key === "Escape") { closeSearch(); $("#app").classList.remove("menu-open"); }
});

drawRing(3, 4);
