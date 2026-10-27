import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { invokeCommand, isDesktop } from "@/lib/ipc"
import { useFriday } from "@/lib/store"

export interface SpeechState { status:string; error:string | null; rms:number; partial_available:boolean; startup_ms:number | null; metrics:Record<string,number> | null; generation:number }
export function SpeechReadiness() {
  const [error,setError]=useState<string | null>(null)
  const state=useQuery({queryKey:["speech-readiness"],enabled:isDesktop,queryFn:()=>invokeCommand<SpeechState>("get_speech_status"),refetchInterval:2000})
  useEffect(()=>{
    const onError=(event:Event)=>{if(event instanceof CustomEvent && typeof event.detail==="string")setError(event.detail)}
    window.addEventListener("friday:voice-error",onError)
    return ()=>window.removeEventListener("friday:voice-error",onError)
  },[])
  const status=state.data?.status
  if (!isDesktop || (!error && !["starting","ready","failed"].includes(status || "")))return null
  return <div className="voice-readiness" aria-live="polite">
    {status==="starting" && <p role="status">Starting local speech and opening microphone…</p>}
    {status==="ready" && <span className="instrument-label">Microphone ready · {state.data?.partial_available ? "Live transcript" : "Final transcript after speech"}</span>}
    {(error || state.data?.error) && <p role="alert">{error || state.data?.error}<button className="quiet-action ml-2" type="button" onClick={()=>{setError(null);void useFriday.getState().startVoiceCapture()}}>Retry capture</button></p>}
  </div>
}
