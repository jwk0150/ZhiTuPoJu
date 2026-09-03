$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $files = Get-ChildItem -Path 'd:\Learning_test\backup3\ZhiTuPoJu' -Filter '*.docx' | Where-Object { $_.Name -notlike '~$*' }
    foreach ($f in $files) {
        try {
            $doc = $word.Documents.Open($f.FullName, $false, $true)
            $pc = $doc.ComputeStatistics(2)
            $words = $doc.ComputeStatistics(0)
            Write-Output ("FILE: " + $f.Name)
            Write-Output ("PAGES: " + $pc)
            Write-Output ("WORDS: " + $words)
            $doc.Close($false)
        } catch {
            Write-Output ("ERR_FILE: " + $f.Name + " :: " + $_.Exception.Message)
        }
    }
    $word.Quit()
    Write-Output "DONE"
} catch {
    Write-Output ("FATAL: " + $_.Exception.Message)
}
