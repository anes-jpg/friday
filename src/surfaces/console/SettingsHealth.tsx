import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { invokeCommand, isDesktop } from "@/lib/ipc"
import type { SpeechState } from "@/components/voice/SpeechReadiness"

interface Health {
  providers:Array<{id:string;name:string;configured:boolean;active:boolean;tested:boolean}>
  speech:SpeechState
  python:{Ok?:string;Err?:string}
  speech_resource:{Ok?:string;Err?:string}
  storage:{status:string;integrity:string;schema_version:number;durable:boolean}
  scheduler:{running:boolean;unattended:string}
  resources:{cpu_percent:number|null;rss_mb:number|null;peak_rss_mb:number|null}
  capabilities?:Record<string,string>
}
export function SettingsHealth() {
  const health=useQuery({queryKey:["settings-health"],enabled:isDesktop,queryFn:()=>invokeCommand<Health>("get_settings_health")})
  return <section className="settings-section" aria-label="Settings health">
    <Button variant="outline" size="sm" disabled={!isDesktop || health.isFetching} onClick={()=>void health.refetch()}>{health.isFetching ? "Checking…" : "Refresh health"}</Button>
    {!isDesktop && <p>Unavailable in browser preview. Open the Windows app to check native services.</p>}
    {health.isError && <p role="alert">{health.error.message}</p>}
    {health.data && <dl className="settings-health-grid"><dt>Providers</dt><dd>{health.data.providers.map(provider=><p key={provider.id}>{provider.name}{provider.active ? " · current" : ""} · {provider.configured ? "Configured" : "Incomplete"} · {provider.tested ? "Test history available" : "Connection not tested"}</p>)}</dd>
      <dt>Speech capture</dt><dd>{health.data.speech.status}{health.data.speech.error && <p>{health.data.speech.error}</p>}{health.data.speech.startup_ms!=null && <p>Startup {health.data.speech.startup_ms.toFixed(0)} ms</p>}<p>{health.data.python.Err || (health.data.python.Ok ? "External Python runtime discovered" : "Python unavailable")} · {health.data.speech_resource.Err || "Speech adapter resource discovered"}</p><p>Whistle partial recognition: {health.data.speech.partial_available ? "Available" : "Unavailable"}</p></dd>
      <dt>Storage</dt><dd>{health.data.storage.status} · integrity {health.data.storage.integrity} · migration {health.data.storage.schema_version}{!health.data.storage.durable && " · persistence unavailable"}</dd>
      <dt>Scheduler</dt><dd>{health.data.scheduler.running ? "Running" : "Unavailable"}<p>{health.data.scheduler.unattended}</p></dd>
      <dt>Camera capabilities</dt><dd>{typeof navigator.mediaDevices?.getUserMedia === "function" ? "Webcam capture available" : "Webcam capture unavailable"} · {typeof MediaRecorder!=="undefined" ? "Manual recording available" : "Recording unavailable"} · RTSP unavailable</dd>
      <dt>Process resources</dt><dd>CPU {health.data.resources.cpu_percent==null ? "Unavailable until a second sample" : `${health.data.resources.cpu_percent.toFixed(2)}%`} · RSS {health.data.resources.rss_mb==null ? "Unavailable" : `${health.data.resources.rss_mb.toFixed(1)} MB`} · Peak {health.data.resources.peak_rss_mb==null ? "Unavailable" : `${health.data.resources.peak_rss_mb.toFixed(1)} MB`}</dd>
      <dt>Capability status</dt><dd>{Object.entries(health.data.capabilities ?? {}).map(([key,value])=><p key={key}>{key}: {value}</p>)}</dd>
      <dt>Wake word</dt><dd>Unavailable · use push to talk</dd>
    </dl>}
  </section>
}
