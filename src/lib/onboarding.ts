const stepKey = "friday-guide-step-v1"
const deferredKey = "friday-guide-deferred-v1"

export function readGuideStep(stepCount: number): number {
  try {
    const value = Number(localStorage.getItem(stepKey))
    return Number.isInteger(value) && value >= 0 && value < stepCount ? value : 0
  } catch { return 0 }
}
export function rememberGuideStep(step: number) { localStorage.setItem(stepKey, String(step)) }
export function deferGuide() { localStorage.setItem(deferredKey, "true") }
export function completeGuide() {
  localStorage.setItem("friday_onboarded_v1_0", "true")
  localStorage.setItem("friday_onboarded", "true")
}
export function shouldShowGuide(): boolean {
  try { return localStorage.getItem("friday_onboarded_v1_0") !== "true" && localStorage.getItem(deferredKey) !== "true" }
  catch { return true }
}
