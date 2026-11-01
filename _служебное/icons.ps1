# App icon: brand blue square, white open book, signature line blue 61% / rose 39%. ASCII only (PS 5.1).
Add-Type -AssemblyName System.Drawing
$out = Join-Path $PSScriptRoot '..\icons'
foreach ($size in 192, 512) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $k = $size / 512.0
  $g.Clear([System.Drawing.ColorTranslator]::FromHtml('#3D6492'))
  $white = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#FCFCFA'))
  $fog = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#CBD9E7')), (6 * $k)
  # two pages of an open book
  $left = [System.Drawing.PointF[]]@(
    (New-Object System.Drawing.PointF (120*$k), (170*$k)), (New-Object System.Drawing.PointF (250*$k), (190*$k)),
    (New-Object System.Drawing.PointF (250*$k), (350*$k)), (New-Object System.Drawing.PointF (120*$k), (330*$k)))
  $right = [System.Drawing.PointF[]]@(
    (New-Object System.Drawing.PointF (262*$k), (190*$k)), (New-Object System.Drawing.PointF (392*$k), (170*$k)),
    (New-Object System.Drawing.PointF (392*$k), (330*$k)), (New-Object System.Drawing.PointF (262*$k), (350*$k)))
  $g.FillPolygon($white, $left)
  $g.FillPolygon($white, $right)
  # text lines on pages
  for ($i = 0; $i -lt 4; $i++) {
    $y = 222 + $i * 28
    $g.DrawLine($fog, (145*$k), (($y - 3)*$k), (228*$k), (($y + 10)*$k))
    $g.DrawLine($fog, (284*$k), (($y + 10)*$k), (367*$k), (($y - 3)*$k))
  }
  # signature line under the book
  $bw = 272 * $k; $x0 = 120 * $k; $y0 = 382 * $k; $h = 14 * $k
  $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#FCFCFA'))), $x0, $y0, ($bw * 0.61), $h)
  $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#DFC0D2'))), ($x0 + $bw * 0.61), $y0, ($bw * 0.39), $h)
  $bmp.Save((Join-Path $out ("icon-" + $size + ".png")), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}
Write-Output 'icons ok'
