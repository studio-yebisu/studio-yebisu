<#
.SYNOPSIS
  Synthesizes the Shiori Kobo subtitle-desk example input with a local Windows voice.

.DESCRIPTION
  Reads input/script.json (UTF-8), checks that reference_text is exactly the
  joined sentences, and speaks it with the installed "Microsoft Haruka Desktop"
  voice through System.Speech.Synthesis.SpeechSynthesizer (rate -1, volume 100)
  into a 22050 Hz 16-bit mono WAV.

  - Local only: no network, no account, no change to Windows or user settings.
  - Fails if the voice is missing or disabled.
  - Never overwrites an existing WAV; writes "<out>.partial" first and renames.
  - Does not print the script text.

  This file is ASCII-only on purpose so Windows PowerShell 5.1 and PowerShell 7
  read it the same way. The Japanese text comes only from script.json.

  The ASR input is made afterwards by ffmpeg (see README.md):
    ffmpeg -n -i input/review-ja-source.wav -ar 16000 -ac 1 -c:a pcm_s16le input/review-ja.wav

.PARAMETER ScriptPath
  Script JSON. Default: <this folder>/input/script.json

.PARAMETER OutPath
  WAV to create. Default: <this folder>/input/review-ja-source.wav

.EXAMPLE
  pwsh -File make_input.ps1
#>
[CmdletBinding()]
param(
  [string]$ScriptPath,
  [string]$OutPath
)

Set-StrictMode -Version 3.0
$ErrorActionPreference = 'Stop'

$taskRoot = $PSScriptRoot
$expectedId = 'review-ja'
$expectedVoice = 'Microsoft Haruka Desktop'
$expectedRate = -1
$expectedVolume = 100
$sampleRate = 22050

function Resolve-TaskPath([string]$Path) {
  # Resolve relative to the current PowerShell location, not the process directory.
  return $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Path)
}

if (-not $ScriptPath) { $ScriptPath = Join-Path $taskRoot 'input/script.json' }
if (-not $OutPath) { $OutPath = Join-Path $taskRoot 'input/review-ja-source.wav' }
$scriptFull = Resolve-TaskPath $ScriptPath
$outFull = Resolve-TaskPath $OutPath
$partialFull = "$outFull.partial"

if (-not (Test-Path -LiteralPath $scriptFull -PathType Leaf)) {
  throw "Script not found: $scriptFull"
}
if (Test-Path -LiteralPath $outFull) {
  throw "Output already exists; not overwriting: $outFull"
}
if (Test-Path -LiteralPath $partialFull) {
  throw "A partial file from an earlier attempt exists; inspect and remove it first: $partialFull"
}
$outDir = Split-Path -Parent $outFull
if (-not (Test-Path -LiteralPath $outDir -PathType Container)) {
  throw "Output folder does not exist: $outDir"
}

$utf8 = New-Object System.Text.UTF8Encoding($false)
$doc = [System.IO.File]::ReadAllText($scriptFull, $utf8) | ConvertFrom-Json

if ([string]$doc.id -cne $expectedId) { throw "script.json id must be '$expectedId'." }
if ([string]$doc.language -cne 'ja') { throw "script.json language must be 'ja'." }
if ([string]$doc.kind -cne 'synthetic') { throw "script.json kind must be 'synthetic'." }
if ([string]$doc.voice_name -cne $expectedVoice) { throw "script.json voice_name must be '$expectedVoice'." }
if ([int]$doc.sapi_rate -ne $expectedRate) { throw "script.json sapi_rate must be $expectedRate." }

$text = [string]$doc.reference_text
$joined = (@($doc.sentences) | ForEach-Object { [string]$_ }) -join ''
if ([string]::IsNullOrWhiteSpace($text)) { throw 'script.json reference_text is empty.' }
if ($text -cne $joined) { throw 'script.json reference_text is not exactly the joined sentences.' }

try {
  Add-Type -AssemblyName System.Speech
} catch {
  throw "Cannot load System.Speech. Windows PowerShell 5.1 (powershell.exe -File make_input.ps1) also works. $($_.Exception.Message)"
}

$synth = $null
$finished = $false
try {
  $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $installed = @($synth.GetInstalledVoices() | Where-Object {
      $_.Enabled -and $_.VoiceInfo.Name -ceq $expectedVoice
    })
  if ($installed.Count -lt 1) {
    throw "Voice '$expectedVoice' is not installed or not enabled. No other voice is used."
  }
  $synth.SelectVoice($expectedVoice)
  if ($synth.Voice.Name -cne $expectedVoice) {
    throw "Selected voice is '$($synth.Voice.Name)', expected '$expectedVoice'."
  }
  $synth.Rate = $expectedRate
  $synth.Volume = $expectedVolume

  $format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(
    $sampleRate,
    [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,
    [System.Speech.AudioFormat.AudioChannel]::Mono
  )
  $synth.SetOutputToWaveFile($partialFull, $format)
  $synth.Speak($text)
  # Close the wave file before renaming it.
  $synth.SetOutputToNull()

  Move-Item -LiteralPath $partialFull -Destination $outFull
  $finished = $true
} finally {
  if ($null -ne $synth) {
    try { $synth.SetOutputToNull() } catch { }
    $synth.Dispose()
  }
  if (-not $finished -and (Test-Path -LiteralPath $partialFull)) {
    Remove-Item -LiteralPath $partialFull
  }
}

$hash = (Get-FileHash -LiteralPath $outFull -Algorithm SHA256).Hash.ToLowerInvariant()
Write-Output "Wrote: $outFull"
Write-Output "Voice: $expectedVoice; rate $expectedRate; volume $expectedVolume; $sampleRate Hz 16-bit mono"
Write-Output "SHA256: $hash"
