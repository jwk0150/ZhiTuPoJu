param(
    [string]$InFile = "D:\Learning_test\backup3\ZhiTuPoJu\_docx_work\final.docx",
    [string]$OutFile = "D:\Learning_test\backup3\ZhiTuPoJu\_docx_work\final_toc.docx"
)
$ErrorActionPreference = "Stop"
Write-Output ("IN=" + $InFile)
Write-Output ("OUT=" + $OutFile)
$word = $null
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $doc = $word.Documents.Open($InFile, $false, $true)
    foreach ($toc in $doc.TablesOfContents) {
        $toc.Update()
    }
    $doc.Fields.Update() | Out-Null
    $pages = $doc.ComputeStatistics(2)
    Write-Output ("PAGES_AFTER_TOC_UPDATE=" + $pages)
    $doc.Close($false)
    $doc = $word.Documents.Open($InFile, $false, $false)
    $doc.SaveAs2($OutFile, 12)
    $doc.Close($false)
    Write-Output "SAVED"
}
finally {
    if ($word) { $word.Quit() }
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
