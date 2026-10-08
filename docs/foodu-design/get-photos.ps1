# Downloads the food photos used by the Foodu designs into docs\foodu-design\img
# (the same Unsplash photos your frontend\index.html already links to).
# Run once from the project folder:
#   powershell -ExecutionPolicy Bypass -File docs\foodu-design\get-photos.ps1
$ErrorActionPreference = "Stop"
$dir = Join-Path $PSScriptRoot "img"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$photos = [ordered]@{
  "hero-groceries"   = "photo-1610348725531-843dff563e2c"
  "hero-sushi"       = "photo-1579871494447-9811cf80d66c"
  "burger"           = "photo-1568901346375-23c9450c58cd"
  "grocery-shelf"    = "photo-1542838132-92c53300491e"
  "dineout"          = "photo-1544025162-d76694265947"
  "biryani"          = "photo-1563379091339-03b21ab4a4f8"
  "pizza"            = "photo-1513104890138-7c749659a591"
  "north-indian"     = "photo-1585937421612-70a008356fbe"
  "south-indian"     = "photo-1610192244261-3f33de3f55e4"
  "dosa"             = "photo-1668236543090-82eba5ee5976"
  "idli"             = "photo-1589301760014-d929f3979dbc"
  "desserts"         = "photo-1587314168485-3236d6710814"
  "tea"              = "photo-1544787219-7f47ccb76574"
  "chinese"          = "photo-1569718212165-3a8278d5f624"
  "rolls"            = "photo-1626777552726-4a6b54c97e46"
  "salad"            = "photo-1512621776951-a57141f2eefd"
  "restaurant-1"     = "photo-1517248135467-4c7edcad34c4"
  "restaurant-2"     = "photo-1555396273-367ea4eb4db5"
  "cafe"             = "photo-1554118811-1e0d58224f24"
}
foreach ($name in $photos.Keys) {
  $url = "https://images.unsplash.com/$($photos[$name])?w=800&q=75&fm=jpg&fit=crop"
  $out = Join-Path $dir "$name.jpg"
  Write-Host "Downloading $name ..."
  Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing
}
Write-Host "Done. $($photos.Count) photos saved in $dir"
