import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import "./ui-fonts.css"
import App from "./App.tsx"

// A stale deploy can remove the chunk a lazy route asks for; reload once to fetch the new files.
// The timestamp guard stops a reload loop when the chunk is genuinely missing; the route boundary then shows.
window.addEventListener("vite:preloadError", (event) => {
  try {
    const last = Number(sessionStorage.getItem("ns-preload-reload") ?? 0)
    if (Date.now() - last < 60_000) return
    sessionStorage.setItem("ns-preload-reload", String(Date.now()))
  } catch {
    return
  }
  event.preventDefault()
  window.location.reload()
})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
