use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaProbeResult {
    pub file_name: String,
    pub file_size_bytes: u64,
    pub extension: String,
    pub mime_type: String,
    pub is_audio: bool,
    pub is_video: bool,
    pub is_image: bool,
}

pub struct DelphiTools;

impl DelphiTools {
    /// Inspect media / file metadata (inspired by delphitools/media-probe.ts)
    pub fn probe_file<P: AsRef<Path>>(path: P) -> Result<MediaProbeResult, String> {
        let p = path.as_ref();
        let metadata = std::fs::metadata(p).map_err(|e| e.to_string())?;
        let file_name = p
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        let ext = p
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default();

        let (mime_type, is_audio, is_video, is_image) = match ext.as_str() {
            "wav" => ("audio/wav".to_string(), true, false, false),
            "mp3" => ("audio/mpeg".to_string(), true, false, false),
            "ogg" => ("audio/ogg".to_string(), true, false, false),
            "flac" => ("audio/flac".to_string(), true, false, false),
            "mp4" => ("video/mp4".to_string(), false, true, false),
            "webm" => ("video/webm".to_string(), false, true, false),
            "mkv" => ("video/x-matroska".to_string(), false, true, false),
            "png" => ("image/png".to_string(), false, false, true),
            "jpg" | "jpeg" => ("image/jpeg".to_string(), false, false, true),
            "webp" => ("image/webp".to_string(), false, false, true),
            "gif" => ("image/gif".to_string(), false, false, true),
            "svg" => ("image/svg+xml".to_string(), false, false, true),
            _ => ("application/octet-stream".to_string(), false, false, false),
        };

        Ok(MediaProbeResult {
            file_name,
            file_size_bytes: metadata.len(),
            extension: ext,
            mime_type,
            is_audio,
            is_video,
            is_image,
        })
    }

    /// Format or validate JSON (inspired by delphitools/json-format.ts)
    pub fn format_json(raw: &str, pretty: bool) -> Result<String, String> {
        let val: Value = serde_json::from_str(raw).map_err(|e| format!("Invalid JSON: {}", e))?;
        if pretty {
            serde_json::to_string_pretty(&val).map_err(|e| e.to_string())
        } else {
            serde_json::to_string(&val).map_err(|e| e.to_string())
        }
    }

    /// Generate UUID v4 (inspired by delphitools/uuid.ts)
    pub fn generate_uuid() -> String {
        let now_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let rand_val = (now_ms ^ 0x5a5a5a5a5a5a5a5a) & 0xffffffffffffffff;
        format!(
            "{:08x}-{:04x}-4{:03x}-{:04x}-{:012x}",
            (now_ms & 0xffffffff) as u32,
            ((now_ms >> 32) & 0xffff) as u16,
            ((now_ms >> 48) & 0x0fff) as u16,
            (0x8000 | ((rand_val & 0x3fff) as u16)),
            rand_val as u64 & 0xffffffffffff
        )
    }

    /// Decode JWT payload (inspired by delphitools/jwt.ts)
    pub fn decode_jwt_payload(token: &str) -> Result<Value, String> {
        let parts: Vec<&str> = token.split('.').collect();
        if parts.len() != 3 {
            return Err("Invalid JWT format: expected 3 dot-separated parts".to_string());
        }

        // Base64URL decode the payload (second part)
        let payload_b64 = parts[1];
        let mut padded = payload_b64.replace('-', "+").replace('_', "/");
        while !padded.len().is_multiple_of(4) {
            padded.push('=');
        }

        // Simple manual base64 decoding
        let bytes =
            Self::base64_decode(&padded).map_err(|e| format!("Failed to decode base64: {}", e))?;
        let json_str = String::from_utf8(bytes).map_err(|e| format!("Invalid UTF-8: {}", e))?;
        serde_json::from_str(&json_str).map_err(|e| format!("Invalid JSON payload: {}", e))
    }

    fn base64_decode(input: &str) -> Result<Vec<u8>, String> {
        const B64_CHARS: &[u8; 64] =
            b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        let mut out = Vec::new();
        let mut buf = 0u32;
        let mut bits = 0;

        for &b in input.as_bytes() {
            if b == b'=' {
                break;
            }
            if let Some(pos) = B64_CHARS.iter().position(|&c| c == b) {
                buf = (buf << 6) | (pos as u32);
                bits += 6;
                if bits >= 8 {
                    bits -= 8;
                    out.push(((buf >> bits) & 0xff) as u8);
                }
            }
        }

        Ok(out)
    }
}
