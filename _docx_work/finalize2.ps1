param(
    [string]$InFile = "D:\Learning_test\backup3\ZhiTuPoJu\_docx_work\final.docx"
)
$ErrorActionPreference = "Stop"
$desktop = [Environment]::GetFolderPath('Desktop')
Write-Output ("DESKTOP=" + $desktop)
$outFile = Join-Path $desktop "文档最终版.docx"
Write-Output ("OUT=" + $outFile)
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
    $doc.Close($false)
    $doc = $word.Documents.Open($InFile, $false, $false)
    $doc.SaveAs2($outFile, 12)
    $pages = $doc.ComputeStatistics(2)
    Write-Output ("PAGES_AFTER_SAVE=" + $pages)
    $doc.Close($false)
}
finally {
    if ($word) { $word.Quit() }
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
