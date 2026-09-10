# bench/hardware_bench.ps1 — M0 Hardware Benchmark Harness for FRIDAY
Write-Host '==========================================================' -ForegroundColor Cyan
Write-Host ' FRIDAY M0 - Hardware and Environment Benchmark Harness' -ForegroundColor Cyan
Write-Host '==========================================================' -ForegroundColor Cyan

# 1. CPU sustained clocks and cores
Write-Host "`n[1/3] CPU Information and Clock Speed:" -ForegroundColor Yellow
Get-CimInstance Win32_Processor |
  Select-Object Name, NumberOfCores, NumberOfLogicalProcessors, MaxClockSpeed, CurrentClockSpeed |
  Format-Table -AutoSize

# 2. GPU temperature, memory, and utilization
Write-Host '[2/3] NVIDIA GPU State (if present):' -ForegroundColor Yellow
if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) {
    nvidia-smi --query-gpu=name,memory.total,temperature.gpu,utilization.gpu --format=csv
} else {
    Write-Host 'nvidia-smi not in PATH. Checking WMI Video Controller:' -ForegroundColor Gray
    Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM, DriverVersion | Format-Table -AutoSize
}

# 3. RAM Headroom
Write-Host '[3/3] Physical Memory Headroom:' -ForegroundColor Yellow
Get-CimInstance Win32_OperatingSystem |
  Select-Object @{n="FreeRAM_GB";e={[math]::Round($_.FreePhysicalMemory/1MB,2)}},
                @{n="TotalRAM_GB";e={[math]::Round($_.TotalVisibleMemorySize/1MB,2)}} |
  Format-Table -AutoSize

Write-Host 'Hardware benchmark check complete.' -ForegroundColor Green
