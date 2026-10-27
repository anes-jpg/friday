# ADR 010: Versioned desktop settings and isolated provider credentials

Accepted. No new dependency.

Settings use a versioned SQLite document with optimistic revisions. A save validates all fields, stores credentials in Windows Credential Manager under a provider-specific account, and commits metadata in a SQLite transaction. Credential changes are rolled back if the database commit fails. API keys are never returned in settings responses or stored in the settings JSON. Legacy keys are removed only after migration succeeds.

Provider display names and model identifiers are separate. Each profile selects Chat Completions or Responses explicitly. Fallback is opt-in for each profile; keys must never be reused across profile endpoints. The existing fleet remains available as legacy data while new profiles own active routing.

Fonts are bundled IBM Plex WOFF2 assets under the included SIL Open Font License, requiring no network connection at runtime. Camera capture uses the existing WebView media APIs for webcams and browser-playable feeds. Native FFmpeg IP-camera ingestion remains a separate media-runtime milestone.
The existing keyring dependency must enable its `windows-native` feature. Without it, keyring 3 uses a volatile mock store on Windows. Keys must survive application restarts in Windows Credential Manager.
