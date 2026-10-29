import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Onboarding } from "./Onboarding"

export function OnboardingModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose() }}><DialogContent className="friday-guide-dialog" showCloseButton={false}><DialogTitle className="sr-only">FRIDAY workspace guide</DialogTitle><DialogDescription className="sr-only">Connect a model, discover businesses, build websites, keep context, and control local speech.</DialogDescription><Onboarding onDone={onClose} /></DialogContent></Dialog>
}
