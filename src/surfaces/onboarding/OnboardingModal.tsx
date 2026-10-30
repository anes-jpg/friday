import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Onboarding } from "./Onboarding"

export function OnboardingModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return <Dialog open={isOpen}><DialogContent className="friday-guide-dialog" showCloseButton={false} onEscapeKeyDown={event => { event.preventDefault(); document.getElementById("guide-later")?.click() }} onInteractOutside={event => event.preventDefault()} onOpenAutoFocus={event => { event.preventDefault(); document.getElementById("guide-heading")?.focus() }}><DialogTitle className="sr-only">FRIDAY workspace guide</DialogTitle><DialogDescription className="sr-only">Choose a goal, connect any compatible model, bring context, and control local speech. Every step is optional.</DialogDescription><Onboarding onDone={onClose} /></DialogContent></Dialog>
}
