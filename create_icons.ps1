Add-Type -AssemblyName System.Drawing

# Create the icons in different sizes
$sizes = @(16, 48, 128)

foreach ($size in $sizes) {
    # Create a bitmap with the specified size
    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    
    # Clear with gradient-like background (using blue fill for simplicity)
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(64, 86, 255))
    $graphics.FillRectangle($brush, 0, 0, $size, $size)
    
    # Add a white "M" letter
    $font = New-Object System.Drawing.Font("Arial", [math]::Floor($size * 0.7), [System.Drawing.FontStyle]::Bold)
    $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $stringFormat = New-Object System.Drawing.StringFormat
    $stringFormat.Alignment = [System.Drawing.StringAlignment]::Center
    $stringFormat.LineAlignment = [System.Drawing.StringAlignment]::Center
    $graphics.DrawString("M", $font, $textBrush, [float]($size/2), [float]($size/2), $stringFormat)
    
    # Save the bitmap
    $outputPath = "images/icon$size.png"
    $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    
    # Clean up
    $graphics.Dispose()
    $bitmap.Dispose()
    
    Write-Host "Created $outputPath"
}

Write-Host "All icons created successfully!"
