use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum LocalIntent {
    Media(String),        // "mute", "volume_up", "volume_down", "play_pause", "next", "prev"
    SystemVitals(String), // "gpu", "ram", "all"
    Git(String),          // "branch", "status"
    WindowFocus(String),  // process name or title snippet e.g. "chrome", "code", "spotify"
    Clipboard(String),    // "read", "clear"
    SpatialHud(String),   // "fullscreen", "godseye", "split", "legion", "grid"
}

pub struct SemanticRouter;

impl SemanticRouter {
    /// Normalizes input utterance and routes directly to on-device action if matched (<1ms)
    pub fn route(utterance: &str) -> Option<LocalIntent> {
        let clean = utterance.trim();
        if clean.is_empty() {
            return None;
        }

        let lower = clean.to_lowercase();
        let trimmed_punct = lower.trim_end_matches(['.', '!', '?', ',', ';', ':']).trim();
        let trimmed_please = trimmed_punct
            .strip_suffix("please")
            .map(|s| s.trim_end_matches([',', ' ']).trim())
            .unwrap_or(trimmed_punct);
        let trimmed = Self::strip_conversational_prefix(trimmed_please);

        // Guardrails: Never route complex reasoning, code generation, tutorials, or open-ended questions locally
        if Self::is_guarded_query(trimmed) {
            return None;
        }

        // 1. Media Control Patterns
        if let Some(media) = Self::route_media(trimmed) {
            return Some(LocalIntent::Media(media));
        }

        // 2. Hardware Telemetry & System Vitals
        if let Some(vitals) = Self::route_vitals(trimmed) {
            return Some(LocalIntent::SystemVitals(vitals));
        }

        // 3. Git Repository Status
        if let Some(git) = Self::route_git(trimmed) {
            return Some(LocalIntent::Git(git));
        }

        // 4. Clipboard Operations
        if let Some(clip) = Self::route_clipboard(trimmed) {
            return Some(LocalIntent::Clipboard(clip));
        }

        // 5. Spatial HUD & Layout Switching
        if let Some(hud) = Self::route_hud(trimmed) {
            return Some(LocalIntent::SpatialHud(hud));
        }

        // 6. Window Focus & App Switching
        if let Some(app) = Self::route_window_focus(trimmed) {
            return Some(LocalIntent::WindowFocus(app));
        }

        None
    }

    /// Recursively strips leading conversational fillers and wake-words
    pub fn strip_conversational_prefix(input: &str) -> &str {
        let mut s = input.trim();
        let prefixes = [
            "hey friday,", "hey friday:", "hey friday",
            "hi friday,", "hi friday:", "hi friday",
            "ok friday,", "ok friday:", "ok friday",
            "okay friday,", "okay friday:", "okay friday",
            "friday,", "friday:", "friday",
            "yo friday,", "yo friday:", "yo friday",
            "hey,", "hey:", "hey",
            "hi,", "hi:", "hi",
            "yo,", "yo:", "yo",
            "please",
            "can you please",
            "could you please",
            "would you please",
            "can you",
            "could you",
            "would you",
            "go ahead and",
            "i need you to",
        ];

        let mut changed = true;
        while changed {
            changed = false;
            for prefix in &prefixes {
                if s.starts_with(prefix) {
                    let next = s[prefix.len()..].trim_start_matches([',', ':', ';', ' ']).trim();
                    if !next.is_empty() {
                        s = next;
                        changed = true;
                        break;
                    }
                }
            }
        }
        s
    }

    fn is_guarded_query(s: &str) -> bool {
        let guarded_prefixes = [
            "how to", "how do", "how can", "why is", "why does", "explain",
            "write a", "write me", "create a", "build a", "make a", "generate",
            "code a", "implement", "script a", "tell me about", "what is the difference",
            "difference between", "teach me", "guide me", "give me an example",
        ];

        for prefix in &guarded_prefixes {
            if s.starts_with(prefix) {
                return true;
            }
        }

        // Check if query is explicitly asking for programming or OpenUI UI generation
        if (s.contains("python") || s.contains("rust") || s.contains("javascript") || s.contains("typescript") || s.contains("html"))
            && (s.contains("code") || s.contains("function") || s.contains("script") || s.contains("file")) {
            return true;
        }

        if s.contains("calculator") || s.contains("dashboard") || s.contains("mockup") || s.contains("prototype") {
            return true;
        }

        false
    }

    fn route_media(s: &str) -> Option<String> {
        match s {
            "mute" | "unmute" | "mute audio" | "mute sound" | "toggle mute" | "silence audio"
            | "silence" | "unmute audio" | "be quiet" | "mute volume" => {
                Some("mute".to_string())
            }
            "volume up" | "turn it up" | "turn up the volume" | "louder" | "increase volume"
            | "raise volume" | "boost volume" | "turn volume up" | "crank it up" | "higher volume" => {
                Some("volume_up".to_string())
            }
            "volume down" | "turn it down" | "turn down the volume" | "quieter" | "decrease volume"
            | "lower volume" | "turn volume down" | "soften sound" | "lower the volume" => {
                Some("volume_down".to_string())
            }
            "play" | "pause" | "play pause" | "play / pause" | "play/pause" | "resume"
            | "toggle play" | "toggle playback" | "stop music" | "pause music" | "play music"
            | "resume music" | "pause playback" | "resume playback" | "stop audio"
            | "pause audio" | "resume audio" => {
                Some("play_pause".to_string())
            }
            "next" | "next song" | "next track" | "skip song" | "skip track" | "skip"
            | "next audio" | "play next song" => {
                Some("next".to_string())
            }
            "prev" | "previous" | "previous song" | "previous track" | "last song"
            | "last track" | "replay song" | "restart song" | "back track" => {
                Some("prev".to_string())
            }
            _ => None,
        }
    }

    fn route_vitals(s: &str) -> Option<String> {
        if s == "gpu"
            || s == "gpu temp"
            || s == "gpu temperature"
            || s == "gpu thermals"
            || s == "how hot is my gpu"
            || s == "how hot is the gpu"
            || s == "check gpu thermals"
            || s == "check gpu temp"
            || s == "graphics card temp"
            || s == "graphics card temperature"
            || s == "graphics card thermals"
            || s == "check gpu"
            || s == "gpu status"
            || s == "gpu stats"
            || s == "gpu usage"
            || s == "gpu utilization"
        {
            return Some("gpu".to_string());
        }

        if s == "ram"
            || s == "ram usage"
            || s == "memory usage"
            || s == "check ram"
            || s == "check memory"
            || s == "how much ram"
            || s == "how much ram is used"
            || s == "how much ram is left"
            || s == "how much memory is used"
            || s == "how much memory do i have left"
            || s == "free memory"
            || s == "available memory"
            || s == "ram status"
            || s == "ram stats"
        {
            return Some("ram".to_string());
        }

        if s == "system vitals"
            || s == "system status"
            || s == "pc vitals"
            || s == "hardware telemetry"
            || s == "hardware vitals"
            || s == "cpu temp"
            || s == "cpu usage"
            || s == "system diagnostics"
            || s == "system telemetry"
            || s == "hardware stats"
            || s == "computer vitals"
            || s == "pc stats"
            || s == "check vitals"
            || s == "system specs"
            || s == "vitals"
        {
            return Some("all".to_string());
        }

        None
    }

    fn route_git(s: &str) -> Option<String> {
        if s == "git branch"
            || s == "what branch am i on"
            || s == "what branch is this"
            || s == "current branch"
            || s == "which git branch"
            || s == "which branch am i on"
            || s == "check git branch"
            || s == "get branch"
            || s == "active branch"
            || s == "git current branch"
        {
            return Some("branch".to_string());
        }

        if s == "git status"
            || s == "uncommitted changes"
            || s == "what files are changed"
            || s == "what files did i change"
            || s == "check git status"
            || s == "git changes"
            || s == "working tree status"
            || s == "git diff files"
            || s == "modified files"
            || s == "git modified"
            || s == "any uncommitted changes"
        {
            return Some("status".to_string());
        }

        None
    }

    fn route_clipboard(s: &str) -> Option<String> {
        if s == "check clipboard"
            || s == "read clipboard"
            || s == "show clipboard"
            || s == "inspect clipboard"
            || s == "view clipboard"
            || s == "clipboard content"
            || s == "clipboard contents"
            || s == "what is on my clipboard"
            || s == "what's on my clipboard"
            || s == "what is in my clipboard"
            || s == "what's in my clipboard"
            || s == "get clipboard"
            || s == "paste clipboard"
        {
            return Some("read".to_string());
        }

        if s == "clear clipboard"
            || s == "empty clipboard"
            || s == "wipe clipboard"
            || s == "clean clipboard"
            || s == "erase clipboard"
            || s == "delete clipboard"
        {
            return Some("clear".to_string());
        }

        None
    }

    fn route_hud(s: &str) -> Option<String> {
        if s == "fullscreen"
            || s == "toggle fullscreen"
            || s == "enter fullscreen"
            || s == "exit fullscreen"
            || s == "full screen"
            || s == "toggle full screen"
        {
            return Some("fullscreen".to_string());
        }

        if s == "god's eye"
            || s == "gods eye"
            || s == "open gods eye"
            || s == "open god's eye"
            || s == "switch to gods eye"
            || s == "switch to god's eye"
            || s == "show gods eye"
            || s == "show god's eye"
            || s == "telemetry canvas"
            || s == "god eye"
            || s == "boot up gods eye"
            || s == "boot up god's eye"
            || s == "bring up gods eye"
            || s == "bring up god's eye"
            || s == "launch gods eye"
            || s == "launch god's eye"
            || s == "open the gods eye"
            || s == "open the god's eye"
            || s == "map feed"
            || s == "cameras feed"
            || s == "camera feed"
            || s == "surveillance"
            || s == "surveillance matrix"
            || s == "open surveillance"
        {
            return Some("godseye".to_string());
        }

        if s == "split view"
            || s == "split console"
            || s == "console view"
            || s == "operator view"
            || s == "operator split view"
            || s == "switch to split"
            || s == "switch to console"
            || s == "show split view"
            || s == "open split view"
            || s == "open console"
        {
            return Some("split".to_string());
        }

        if s == "iron legion"
            || s == "legion view"
            || s == "swarm view"
            || s == "open iron legion"
            || s == "switch to legion"
            || s == "show iron legion"
            || s == "legion swarm"
            || s == "iron legion swarm"
            || s == "open legion"
        {
            return Some("legion".to_string());
        }

        if s == "bento grid"
            || s == "grid view"
            || s == "desktop grid"
            || s == "history grid"
            || s == "switch to grid"
            || s == "show bento grid"
            || s == "bento"
            || s == "open grid"
        {
            return Some("grid".to_string());
        }

        if s == "open settings"
            || s == "show settings"
            || s == "show the settings"
            || s == "settings"
            || s == "boot up settings"
            || s == "boot up the settings"
            || s == "open the settings"
            || s == "launch settings"
            || s == "go to settings"
            || s == "take me to settings"
            || s == "switch to settings"
            || s == "bring up settings"
            || s == "bring up the settings"
            || s == "preferences"
            || s == "open preferences"
            || s == "system settings"
            || s == "open system settings"
            || s == "boot up system settings"
            || s == "boot up windows settings"
            || s == "open windows settings"
            || s == "open windows setting"
            || s == "windows settings"
            || s == "windows setting"
            || s == "launch windows settings"
            || s == "bring up windows settings"
            || s == "show windows settings"
            || s == "show windows setting"
            || s == "settings app"
            || s == "open settings app"
        {
            return Some("settings".to_string());
        }

        None
    }

    fn route_window_focus(s: &str) -> Option<String> {
        let prefixes = [
            "focus on ", "focus ", "switch to ", "bring up ", "bring ",
            "activate ", "show window ", "jump to ",
        ];

        for prefix in &prefixes {
            if s.starts_with(prefix) {
                let target = s[prefix.len()..].trim().trim_end_matches("window").trim();
                if !target.is_empty() && target.len() <= 30 && !target.contains("my ") && !target.contains("the ") {
                    return Some(target.to_string());
                }
            }
        }

        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_route_media_intents() {
        assert_eq!(SemanticRouter::route("mute"), Some(LocalIntent::Media("mute".into())));
        assert_eq!(SemanticRouter::route("turn it down!"), Some(LocalIntent::Media("volume_down".into())));
        assert_eq!(SemanticRouter::route("volume up"), Some(LocalIntent::Media("volume_up".into())));
        assert_eq!(SemanticRouter::route("pause music"), Some(LocalIntent::Media("play_pause".into())));
        assert_eq!(SemanticRouter::route("skip track"), Some(LocalIntent::Media("next".into())));
        assert_eq!(SemanticRouter::route("previous song"), Some(LocalIntent::Media("prev".into())));
    }

    #[test]
    fn test_route_vitals_intents() {
        assert_eq!(SemanticRouter::route("gpu temp"), Some(LocalIntent::SystemVitals("gpu".into())));
        assert_eq!(SemanticRouter::route("how hot is my gpu?"), Some(LocalIntent::SystemVitals("gpu".into())));
        assert_eq!(SemanticRouter::route("check ram"), Some(LocalIntent::SystemVitals("ram".into())));
        assert_eq!(SemanticRouter::route("system vitals"), Some(LocalIntent::SystemVitals("all".into())));
        assert_eq!(SemanticRouter::route("hardware telemetry"), Some(LocalIntent::SystemVitals("all".into())));
    }

    #[test]
    fn test_route_git_intents() {
        assert_eq!(SemanticRouter::route("what branch am i on?"), Some(LocalIntent::Git("branch".into())));
        assert_eq!(SemanticRouter::route("git status"), Some(LocalIntent::Git("status".into())));
        assert_eq!(SemanticRouter::route("uncommitted changes"), Some(LocalIntent::Git("status".into())));
    }

    #[test]
    fn test_route_clipboard_intents() {
        assert_eq!(SemanticRouter::route("what is on my clipboard?"), Some(LocalIntent::Clipboard("read".into())));
        assert_eq!(SemanticRouter::route("clear clipboard"), Some(LocalIntent::Clipboard("clear".into())));
    }

    #[test]
    fn test_route_hud_intents() {
        assert_eq!(SemanticRouter::route("fullscreen"), Some(LocalIntent::SpatialHud("fullscreen".into())));
        assert_eq!(SemanticRouter::route("open gods eye"), Some(LocalIntent::SpatialHud("godseye".into())));
        assert_eq!(SemanticRouter::route("hey open gods eye"), Some(LocalIntent::SpatialHud("godseye".into())));
        assert_eq!(SemanticRouter::route("split view"), Some(LocalIntent::SpatialHud("split".into())));
        assert_eq!(SemanticRouter::route("iron legion"), Some(LocalIntent::SpatialHud("legion".into())));
        assert_eq!(SemanticRouter::route("bento grid"), Some(LocalIntent::SpatialHud("grid".into())));
        assert_eq!(SemanticRouter::route("hey boot up the settings"), Some(LocalIntent::SpatialHud("settings".into())));
        assert_eq!(SemanticRouter::route("please open settings"), Some(LocalIntent::SpatialHud("settings".into())));
        assert_eq!(SemanticRouter::route("hey friday, boot up the settings"), Some(LocalIntent::SpatialHud("settings".into())));
        assert_eq!(SemanticRouter::route("boot up windows settings"), Some(LocalIntent::SpatialHud("settings".into())));
        assert_eq!(SemanticRouter::route("windows settings"), Some(LocalIntent::SpatialHud("settings".into())));
        assert_eq!(SemanticRouter::route("can you please open windows settings?"), Some(LocalIntent::SpatialHud("settings".into())));
    }

    #[test]
    fn test_route_window_focus_intents() {
        assert_eq!(SemanticRouter::route("focus chrome"), Some(LocalIntent::WindowFocus("chrome".into())));
        assert_eq!(SemanticRouter::route("switch to vscode"), Some(LocalIntent::WindowFocus("vscode".into())));
        assert_eq!(SemanticRouter::route("bring up spotify"), Some(LocalIntent::WindowFocus("spotify".into())));
    }

    #[test]
    fn test_guardrails_prevent_misrouting() {
        assert_eq!(SemanticRouter::route("how to write a python script to check gpu"), None);
        assert_eq!(SemanticRouter::route("explain git branch vs rebase"), None);
        assert_eq!(SemanticRouter::route("build a loan calculator"), None);
        assert_eq!(SemanticRouter::route("write a python function to mute volume"), None);
        assert_eq!(SemanticRouter::route("create a prototype dashboard"), None);
    }
}
