# FRIDAY Native Windows Speech Recognition Service (§04 & §05)
# Uses built-in Windows System.Speech.Recognition for zero-latency, 100% offline speech recognition.

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

try {
    Add-Type -AssemblyName System.Speech
} catch {
    Write-Error "Failed to load System.Speech assembly: $_"
    exit 1
}

$engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine
try {
    $engine.SetInputToDefaultAudioDevice()
} catch {
    Write-Error "Failed to connect to default audio input device: $_"
    exit 1
}

# 1. High-Priority Wake Word Grammar
$wakeChoices = New-Object System.Speech.Recognition.Choices
$wakeChoices.Add(@("hey friday", "friday", "hey computer", "computer", "operator"))
$wakeBuilder = New-Object System.Speech.Recognition.GrammarBuilder
$wakeBuilder.Append($wakeChoices)
$wakeGrammar = New-Object System.Speech.Recognition.Grammar($wakeBuilder)
$wakeGrammar.Name = "WakeWord"
$wakeGrammar.Priority = 2
$engine.LoadGrammar($wakeGrammar)

# 2. Command Grammar for High-Frequency Desktop Orders
$verbs = New-Object System.Speech.Recognition.Choices
$verbs.Add(@(
    "open", "launch", "start", "run", "close", "quit", "stop", "search", "find",
    "show", "hide", "what is", "what's", "where is", "how to", "tell me", "check", "review",
    "audit", "clear", "mute", "unmute", "help", "pause", "resume", "play", "list", "snapshot"
))

$targets = New-Object System.Speech.Recognition.Choices
$targets.Add(@(
    "spotify", "chrome", "browser", "firefox", "edge", "code", "terminal", "console",
    "calculator", "settings", "window", "screen", "active window", "my screen",
    "cargo check", "git diff", "git status", "review", "audit", "system", "the time",
    "the date", "weather", "music", "microphone", "files"
))

$cmdBuilder = New-Object System.Speech.Recognition.GrammarBuilder
$cmdBuilder.Append($verbs)
$cmdBuilder.Append($targets)
$cmdGrammar = New-Object System.Speech.Recognition.Grammar($cmdBuilder)
$cmdGrammar.Name = "Commands"
$cmdGrammar.Priority = 1
$engine.LoadGrammar($cmdGrammar)

# 3. Dictation Grammar for Freeform Continuous Orders
$dictGrammar = New-Object System.Speech.Recognition.DictationGrammar
$dictGrammar.Name = "Dictation"
$dictGrammar.Priority = 0
$engine.LoadGrammar($dictGrammar)

# Register Event Handlers
Register-ObjectEvent -InputObject $engine -EventName "SpeechRecognized" -Action {
    $res = $EventArgs.Result
    if ($null -eq $res) { return }
    $text = $res.Text.Trim()
    $conf = [math]::Round($res.Confidence, 3)

    if ($text -match '^(hey\s+)?friday$') {
        $msg = [PSCustomObject]@{ type = "wake"; text = $text; confidence = $conf }
        [Console]::WriteLine(($msg | ConvertTo-Json -Compress))
    } elseif ($text -match '^(hey\s+)?friday\s*[,:]?\s*(.+)$') {
        $cmd = $matches[2].Trim()
        $wakeMsg = [PSCustomObject]@{ type = "wake"; text = "hey friday"; confidence = $conf }
        [Console]::WriteLine(($wakeMsg | ConvertTo-Json -Compress))
        if ($cmd.Length -gt 0) {
            $cmdMsg = [PSCustomObject]@{ type = "command"; text = $cmd; confidence = $conf }
            [Console]::WriteLine(($cmdMsg | ConvertTo-Json -Compress))
        }
    } else {
        $cmdMsg = [PSCustomObject]@{ type = "command"; text = $text; confidence = $conf }
        [Console]::WriteLine(($cmdMsg | ConvertTo-Json -Compress))
    }
} | Out-Null

Register-ObjectEvent -InputObject $engine -EventName "SpeechHypothesized" -Action {
    $res = $EventArgs.Result
    if ($null -eq $res) { return }
    $partial = $res.Text.Trim()
    if ($partial.Length -gt 0) {
        $partMsg = [PSCustomObject]@{ type = "partial"; text = $partial }
        [Console]::WriteLine(($partMsg | ConvertTo-Json -Compress))
    }
} | Out-Null

# Start Continuous Recognition
$engine.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Multiple)
[Console]::WriteLine('{"type":"status","status":"ready"}')

# Keep process alive
try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
} finally {
    $engine.RecognizeAsyncStop()
    $engine.Dispose()
}
