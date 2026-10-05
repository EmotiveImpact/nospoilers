import { useEffect, useRef, useState } from "react"
import { EXPLAINER_HOLD, EXPLAINER_MORPH, startExplainer } from "@/components/motion/explainer-particles"

const STEPS = [
  { title: "Watch every release.", body: "Connect GitHub, npm or your website and each new release is checked as it is published." },
  { title: "See what actually ships.", body: "Every file in the package is inspected for source maps, secrets and private paths before customers find them." },
  { title: "Keep the receipt.", body: "Each check ends with a receipt your team can share and verify." },
] as const

const canDraw = () => typeof window !== "undefined" && !/jsdom/i.test(navigator.userAgent)
const prefersReduced = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

/**
 * Left side of the sign-in screen: a particle field walks through watch, inspect
 * and receipt while the matching caption shows. Reduced motion shows the mark
 * still, with all three steps listed.
 */
export function SignInExplainer() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [step, setStep] = useState(0)
  const [reduced] = useState(prefersReduced)

  useEffect(() => {
    if (!canvas.current || !canDraw()) return
    const explainer = startExplainer(canvas.current, { src: "/assets/brand/nospoilers-mark.png", reduced, onStep: setStep })
    return () => explainer.destroy()
  }, [reduced])

  return (
    <div className="sign-in-explainer">
      <canvas ref={canvas} className="sign-in-explainer-field" aria-hidden="true" />
      <ol className={`sign-in-explainer-steps${reduced ? " is-static" : ""}`} aria-label="How NoSpoilers works">
        {STEPS.map((item, index) => (
          <li key={item.title} className={index === step ? "is-active" : undefined}>
            <span className="sign-in-explainer-index" aria-hidden="true">0{index + 1}</span>
            <span className="sign-in-explainer-bar" aria-hidden="true">
              <i style={index === step && !reduced ? { animationDuration: `${EXPLAINER_HOLD + EXPLAINER_MORPH}s` } : undefined} />
            </span>
            <p className="sign-in-explainer-title">{item.title}</p>
            <p className="sign-in-explainer-body">{item.body}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}
