/** FRIDAY Camera PiP Card Component (§04 & Blueprint §4)
 *
 * Draggable Picture-in-Picture optical/webcam monitor card:
 * - Live local operator webcam via WebRTC (getUserMedia)
 * - Public ISS Earth observation and metropolitan CCTV feeds
 * - 0% Idle CPU Law: Uses native GPU-composited video playback
 * - Strict adherence to Surface Law and One-Signal Law
 */

import React, { useState, useEffect, useRef } from "react"
import { motion } from "motion/react"
import { Video, Maximize2, Minimize2, X, Eye, Camera, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

export interface CameraPiPCardProps {
  id?: string
  title?: string
  location?: string
  fps?: number
  onClose?: () => void
  onExpandToMatrix?: () => void
  className?: string
}

export const CameraPiPCard: React.FC<CameraPiPCardProps> = ({
  id = "cam-local",
  title = "Tactical Operator Webcam Feed",
  location = "Local Operator Station",
  fps = 30,
  onClose,
  onExpandToMatrix,
  className,
}) => {
  const [minimized, setMinimized] = useState(false)
  const [activeChannel, setActiveChannel] = useState<"local" | "iss" | "shibuya">("local")
  const [webcamActive, setWebcamActive] = useState(false)
  const [webcamError, setWebcamError] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Start local webcam if activeChannel is local
  useEffect(() => {
    if (activeChannel !== "local" || minimized) return

    let cancelled = false

    const connectWebcam = async () => {
      try {
        setWebcamError(false)
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 360 } },
            audio: false,
          })
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop())
            return
          }
          streamRef.current = stream
          if (videoRef.current) {
            videoRef.current.srcObject = stream
            videoRef.current.play().catch(() => {})
          }
          setWebcamActive(true)
        } else {
          setWebcamError(true)
        }
      } catch {
        setWebcamError(true)
        setWebcamActive(false)
      }
    }

    connectWebcam()

    return () => {
      cancelled = true
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      setWebcamActive(false)
    }
  }, [activeChannel, minimized])

  const feedSources = {
    iss: "https://upload.wikimedia.org/wikipedia/commons/transcoded/8/82/Earth_Views_from_the_International_Space_Station.webm/Earth_Views_from_the_International_Space_Station.webm.360p.vp9.webm",
    shibuya: "https://upload.wikimedia.org/wikipedia/commons/transcoded/5/53/Shibuya_Crossing%2C_Tokyo%2C_Japan_%28video%29.webm/Shibuya_Crossing%2C_Tokyo%2C_Japan_%28video%29.webm.360p.vp9.webm",
  }

  return (
    <motion.div
      drag
      dragMomentum={false}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      className={cn(
        "fixed bottom-20 left-6 z-30 w-84 rounded-[var(--radius-panel)] border border-white/15 bg-[#090A0C]/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden text-white select-none",
        minimized ? "h-auto" : "h-64",
        className
      )}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-white/[0.02] cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-2 min-w-0">
          <span className="size-2 rounded-full bg-[#e02e24] animate-pulse" />
          <div className="min-w-0">
            <h5 className="font-semibold text-xs truncate leading-none text-zinc-200">
              {activeChannel === "local" ? "OPERATOR TACTICAL CAM" : activeChannel === "iss" ? "ISS EARTH ORBIT CAM" : "TOKYO SHIBUYA CCTV"}
            </h5>
            <span className="text-[10px] font-mono text-zinc-400">{location}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {onExpandToMatrix && (
            <button
              type="button"
              onClick={onExpandToMatrix}
              className="size-6 rounded-[var(--radius-control)] hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors cursor-pointer"
              title="Expand to Full CCTV Matrix"
            >
              <Maximize2 className="size-3" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setMinimized(!minimized)}
            className="size-6 rounded-[var(--radius-control)] hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors cursor-pointer"
          >
            {minimized ? <Maximize2 className="size-3" /> : <Minimize2 className="size-3" />}
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="size-6 rounded-[var(--radius-control)] hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors cursor-pointer"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      </div>

      {/* Optical Stage */}
      {!minimized && (
        <div className="relative flex-1 w-full bg-black overflow-hidden flex flex-col justify-between">
          {activeChannel === "local" ? (
            webcamActive ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-black/80 p-3 text-center">
                <Camera className="size-8 text-white/30 mb-2 animate-pulse" />
                <span className="font-mono text-[10px] text-white/70">
                  {webcamError ? "Webcam access denied or unavailable" : "Connecting to Local Camera..."}
                </span>
              </div>
            )
          ) : (
            <video
              src={feedSources[activeChannel]}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          )}

          {/* Clean live indicator overlay */}
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/75 border border-white/10 text-[9px] font-mono text-zinc-300 flex items-center gap-1.5 backdrop-blur-md">
            <span className="size-1.5 rounded-full bg-[#e02e24] animate-pulse" />
            <span className="font-semibold">{activeChannel === "local" ? "LOCAL CAM" : activeChannel.toUpperCase()}</span>
          </div>

          {/* Telemetry Reticle Badge */}
          <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/75 border border-white/10 text-[9px] font-mono text-zinc-300 tabular-nums flex items-center gap-1 backdrop-blur-md">
            <Eye className="size-2.5 text-zinc-400" />
            <span>{fps} FPS</span>
          </div>

          {/* Channel Selector Bar */}
          <div className="p-1.5 bg-black/75 border-t border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveChannel("local")}
                className={cn(
                  "px-2 py-0.5 rounded text-[9px] font-mono transition-colors cursor-pointer",
                  activeChannel === "local"
                    ? "bg-white/20 text-white font-semibold"
                    : "text-white/50 hover:text-white"
                )}
              >
                LOCAL
              </button>
              <button
                type="button"
                onClick={() => setActiveChannel("iss")}
                className={cn(
                  "px-2 py-0.5 rounded text-[9px] font-mono transition-colors cursor-pointer",
                  activeChannel === "iss"
                    ? "bg-white/20 text-white font-semibold"
                    : "text-white/50 hover:text-white"
                )}
              >
                ISS ORBIT
              </button>
              <button
                type="button"
                onClick={() => setActiveChannel("shibuya")}
                className={cn(
                  "px-2 py-0.5 rounded text-[9px] font-mono transition-colors cursor-pointer",
                  activeChannel === "shibuya"
                    ? "bg-white/20 text-white font-semibold"
                    : "text-white/50 hover:text-white"
                )}
              >
                TOKYO
              </button>
            </div>

            <span className="font-mono text-[9px] text-red-400 animate-pulse font-medium">
              ● LIVE
            </span>
          </div>
        </div>
      )}
    </motion.div>
  )
}
