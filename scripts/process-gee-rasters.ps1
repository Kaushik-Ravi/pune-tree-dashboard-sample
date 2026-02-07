# Process GEE Raster Exports
# ===========================
# This script merges tiled GeoTIFFs from GEE export into single COGs
# and prepares them for upload to Cloudflare R2

$ErrorActionPreference = "Stop"

# Configuration
$InputDir = "D:\Products\Product 1\trial 1\pune-tree-dashboard\data\New data"
$OutputDir = "D:\Products\Product 1\trial 1\pune-tree-dashboard\data\processed-rasters"
$PublicDir = "D:\Products\Product 1\trial 1\pune-tree-dashboard\public\rasters"

# Create output directories
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
New-Item -ItemType Directory -Force -Path $PublicDir | Out-Null

# Datasets to process
$datasets = @(
    @{Name="pune_tree_probability_2025"; Description="Tree Cover 2025 (%)"; Band="Float32"},
    @{Name="pune_tree_probability_2019"; Description="Tree Cover 2019 (%)"; Band="Float32"},
    @{Name="pune_tree_change_2019_2025_pct"; Description="Tree Change 2019-2025 (%)"; Band="Float32"},
    @{Name="pune_tree_loss_gain_2019_2025"; Description="Tree Loss/Gain Binary"; Band="Int8"},
    @{Name="pune_ndvi_2025"; Description="NDVI 2025"; Band="Float32"},
    @{Name="pune_landcover_2025"; Description="Land Cover Classification 2025"; Band="UInt8"},
    @{Name="pune_tree_probability_2019_2025"; Description="Multi-year Tree Probability"; Band="Float32"}
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "GEE Raster Processing Pipeline" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

foreach ($dataset in $datasets) {
    $name = $dataset.Name
    $desc = $dataset.Description
    
    Write-Host "Processing: $name" -ForegroundColor Yellow
    Write-Host "  Description: $desc"
    
    # Find all tiles for this dataset
    $tiles = Get-ChildItem "$InputDir\$name-*.tif" | Sort-Object Name
    
    if ($tiles.Count -eq 0) {
        Write-Host "  WARNING: No tiles found for $name" -ForegroundColor Red
        continue
    }
    
    Write-Host "  Found $($tiles.Count) tiles"
    
    # Create VRT (Virtual Raster) to merge tiles
    $vrtFile = "$OutputDir\$name.vrt"
    $mergedFile = "$OutputDir\$name.tif"
    $cogFile = "$PublicDir\$name.tif"
    
    # Build VRT
    Write-Host "  Building VRT..."
    $tileList = ($tiles | ForEach-Object { "`"$($_.FullName)`"" }) -join " "
    $vrtCmd = "gdalbuildvrt `"$vrtFile`" $tileList"
    Invoke-Expression $vrtCmd
    
    # Check if VRT was created
    if (-not (Test-Path $vrtFile)) {
        Write-Host "  ERROR: Failed to create VRT" -ForegroundColor Red
        continue
    }
    
    # Convert to Cloud Optimized GeoTIFF
    Write-Host "  Creating Cloud Optimized GeoTIFF..."
    
    # For smaller files (landcover, loss_gain), use PNG compression
    # For larger float files, use LZW or DEFLATE
    if ($dataset.Band -eq "Int8" -or $dataset.Band -eq "UInt8") {
        $compression = "DEFLATE"
    } else {
        $compression = "LZW"
    }
    
    $cogCmd = @"
gdal_translate "$vrtFile" "$cogFile" `
    -of COG `
    -co COMPRESS=$compression `
    -co PREDICTOR=2 `
    -co BIGTIFF=IF_SAFER `
    -co OVERVIEW_RESAMPLING=AVERAGE `
    -co NUM_THREADS=ALL_CPUS
"@
    
    Invoke-Expression $cogCmd
    
    # Get file size
    if (Test-Path $cogFile) {
        $sizeMB = [math]::Round((Get-Item $cogFile).Length / 1MB, 2)
        Write-Host "  SUCCESS: Created $cogFile ($sizeMB MB)" -ForegroundColor Green
    } else {
        Write-Host "  ERROR: Failed to create COG" -ForegroundColor Red
    }
    
    # Clean up VRT
    Remove-Item $vrtFile -Force -ErrorAction SilentlyContinue
    
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Processing Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Output files are in: $PublicDir"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Upload to Cloudflare R2:"
Write-Host "   wrangler r2 object put pune-tree-dashboard/rasters/pune_tree_probability_2025.tif --file=$PublicDir\pune_tree_probability_2025.tif"
Write-Host ""
Write-Host "2. Or use the web dashboard to upload files"
Write-Host ""

# Summary
Write-Host "File Summary:" -ForegroundColor Yellow
Get-ChildItem $PublicDir -Filter "*.tif" | ForEach-Object {
    $sizeMB = [math]::Round($_.Length / 1MB, 2)
    Write-Host "  $($_.Name): $sizeMB MB"
}
