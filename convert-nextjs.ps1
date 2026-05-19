# Conversion script for migrating Next.js to React Router
$baseDir = "c:\Users\User1\Desktop\Progetti\Equippe\equippe-mvp\src"

# Get all files that need conversion
$files = Get-ChildItem -Path $baseDir -Recurse -Include "*.tsx", "*.ts" | Where-Object { 
    $content = Get-Content $_.FullName -Raw
    $content -match "from ['\"]next/" -or $content -match "process\.env\.NEXT_PUBLIC_"
}

foreach ($file in $files) {
    Write-Host "Converting: $($file.FullName)"
    $content = Get-Content $file.FullName -Raw
    
    # Convert Next.js navigation imports
    $content = $content -replace "import\s+\{\s*useRouter\s*\}\s+from\s+['\"]next/navigation['\"];?", "import { useNavigate } from 'react-router-dom';"
    $content = $content -replace "import\s+\{\s*useRouter,\s*useParams\s*\}\s+from\s+['\"]next/navigation['\"];?", "import { useNavigate, useParams } from 'react-router-dom';"
    $content = $content -replace "import\s+\{\s*useRouter,\s*useSearchParams\s*\}\s+from\s+['\"]next/navigation['\"];?", "import { useNavigate, useSearchParams } from 'react-router-dom';"
    $content = $content -replace "import\s+\{\s*usePathname,\s*useRouter\s*\}\s+from\s+['\"]next/navigation['\"];?", "import { useLocation, useNavigate } from 'react-router-dom';"
    $content = $content -replace "import\s+\{\s*usePathname\s*\}\s+from\s+['\"]next/navigation['\"];?", "import { useLocation } from 'react-router-dom';"
    $content = $content -replace "import\s+\{\s*useParams\s*\}\s+from\s+['\"]next/navigation['\"];?", "import { useParams } from 'react-router-dom';"
    $content = $content -replace "import\s+\{\s*useSearchParams\s*\}\s+from\s+['\"]next/navigation['\"];?", "import { useSearchParams } from 'react-router-dom';"
    
    # Convert Next.js Link imports
    $content = $content -replace "import\s+Link\s+from\s+['\"]next/link['\"];?", "import { Link } from 'react-router-dom';"
    
    # Convert Next.js dynamic imports
    $content = $content -replace "import\s+dynamic\s+from\s+['\"]next/dynamic['\"];?", "import { lazy } from 'react';"
    
    # Convert Next.js metadata imports
    $content = $content -replace "import\s+type\s+\{\s*Metadata,\s*Viewport\s*\}\s+from\s+['\"]next['\"];?", ""
    
    # Convert router usage
    $content = $content -replace "const\s+router\s*=\s*useRouter\(\);?", "const navigate = useNavigate();"
    $content = $content -replace "router\.push\(", "navigate("
    $content = $content -replace "router\.replace\(", "navigate("
    $content = $content -replace "router\.back\(\)", "navigate(-1)"
    
    # Convert pathname usage
    $content = $content -replace "const\s+pathname\s*=\s*usePathname\(\);?", "const location = useLocation(); const pathname = location.pathname;"
    $content = $content -replace "usePathname\(\)", "useLocation().pathname"
    
    # Convert environment variables
    $content = $content -replace "process\.env\.NEXT_PUBLIC_", "import.meta.env.VITE_"
    
    # Convert Link href to to
    $content = $content -replace "<Link\s+href=", "<Link to="
    
    Set-Content -Path $file.FullName -Value $content -Encoding UTF8
    Write-Host "Converted: $($file.Name)"
}

Write-Host "Conversion completed!"