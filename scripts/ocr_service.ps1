param(
    [string]$ImagePath
)

try {
    Add-Type -AssemblyName System.Drawing
    Add-Type -AssemblyName System.Runtime.WindowsRuntime

    [Windows.Media.Ocr.OcrEngine,Windows.Foundation.UniversalApiContract,ContentType=WindowsRuntime] | Out-Null
    [Windows.Graphics.Imaging.BitmapDecoder,Windows.Foundation.UniversalApiContract,ContentType=WindowsRuntime] | Out-Null
    [Windows.Storage.StorageFile,Windows.Foundation.UniversalApiContract,ContentType=WindowsRuntime] | Out-Null

    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
    if (-not $engine) {
        $lang = [Windows.Globalization.Language]::new("en-US")
        $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
    }

    if (-not $engine) {
        Write-Output '{"status":"error","message":"No WinRT OCR language installed"}'
        exit 0
    }

    if (-not (Test-Path $ImagePath)) {
        Write-Output '{"status":"error","message":"Image path does not exist"}'
        exit 0
    }

    $fileTask = [Windows.Storage.StorageFile]::GetFileFromPathAsync((Resolve-Path $ImagePath).Path)
    $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { 
        $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' 
    })[0]

    $asTaskFile = $asTaskGeneric.MakeGenericMethod([Windows.Storage.StorageFile])
    $netTaskFile = $asTaskFile.Invoke($null, @($fileTask))
    $netTaskFile.Wait(-1) | Out-Null
    $storageFile = $netTaskFile.Result

    $streamTask = $storageFile.OpenAsync([Windows.Storage.FileAccessMode]::Read)
    $asTaskStream = $asTaskGeneric.MakeGenericMethod([Windows.Storage.Streams.IRandomAccessStream])
    $netTaskStream = $asTaskStream.Invoke($null, @($streamTask))
    $netTaskStream.Wait(-1) | Out-Null
    $randomAccessStream = $netTaskStream.Result

    $decoderTask = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($randomAccessStream)
    $asTaskDecoder = $asTaskGeneric.MakeGenericMethod([Windows.Graphics.Imaging.BitmapDecoder])
    $netTaskDecoder = $asTaskDecoder.Invoke($null, @($decoderTask))
    $netTaskDecoder.Wait(-1) | Out-Null
    $decoder = $netTaskDecoder.Result

    $softwareBitmapTask = $decoder.GetSoftwareBitmapAsync()
    $asTaskBitmap = $asTaskGeneric.MakeGenericMethod([Windows.Graphics.Imaging.SoftwareBitmap])
    $netTaskBitmap = $asTaskBitmap.Invoke($null, @($softwareBitmapTask))
    $netTaskBitmap.Wait(-1) | Out-Null
    $softwareBitmap = $netTaskBitmap.Result

    $ocrTask = $engine.RecognizeAsync($softwareBitmap)
    $asTaskOcr = $asTaskGeneric.MakeGenericMethod([Windows.Media.Ocr.OcrResult])
    $netTaskOcr = $asTaskOcr.Invoke($null, @($ocrTask))
    $netTaskOcr.Wait(-1) | Out-Null
    $ocrResult = $netTaskOcr.Result

    $lines = @()
    foreach ($line in $ocrResult.Lines) {
        $lines += $line.Text
    }

    $outObj = @{
        status = "ok"
        text = $ocrResult.Text
        lines = $lines
        line_count = $lines.Count
        language = $engine.RecognizerLanguage.LanguageTag
    }

    $outObj | ConvertTo-Json -Compress
} catch {
    $errObj = @{
        status = "error"
        message = $_.Exception.Message
    }
    $errObj | ConvertTo-Json -Compress
}
