# =====================================================
# Nexus Database Setup Script
# Run all migration files in order
# =====================================================

$mysqlPath = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
$migrationPath = "$PSScriptRoot\migrations"

# Colors
$successColor = "Green"
$errorColor = "Red"
$infoColor = "Cyan"

Write-Host "`n========================================" -ForegroundColor $infoColor
Write-Host "  NEXUS DATABASE SETUP" -ForegroundColor $infoColor
Write-Host "========================================`n" -ForegroundColor $infoColor

# Get MySQL credentials
$username = Read-Host "Enter MySQL username (default: root)"
if ([string]::IsNullOrWhiteSpace($username)) {
    $username = "root"
}

$passwordInput = Read-Host "Enter MySQL password (default: 123456)"
if ([string]::IsNullOrWhiteSpace($passwordInput)) {
    $plainPassword = "123456"
} else {
    $plainPassword = $passwordInput
}

Write-Host "`nConnecting to MySQL..." -ForegroundColor $infoColor

# Test connection
$testCmd = "& `"$mysqlPath`" -u $username -p$plainPassword -e `"SELECT 1;`" 2>&1"
$testResult = Invoke-Expression $testCmd

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n[ERROR] Cannot connect to MySQL!" -ForegroundColor $errorColor
    Write-Host "Please check your credentials and try again.`n" -ForegroundColor $errorColor
    exit 1
}

Write-Host "[OK] Connected successfully!`n" -ForegroundColor $successColor

# Get all migration files
$migrationFiles = Get-ChildItem -Path $migrationPath -Filter "*.sql" | Sort-Object Name

if ($migrationFiles.Count -eq 0) {
    Write-Host "[ERROR] No migration files found in $migrationPath`n" -ForegroundColor $errorColor
    exit 1
}

Write-Host "Found $($migrationFiles.Count) migration files to execute:`n" -ForegroundColor $infoColor

foreach ($file in $migrationFiles) {
    Write-Host "  - $($file.Name)" -ForegroundColor $infoColor
}

Write-Host "`n"
$confirm = Read-Host "Do you want to proceed? (yes/no)"

if ($confirm -ne "yes" -and $confirm -ne "y") {
    Write-Host "`n[CANCELLED] Database setup cancelled.`n" -ForegroundColor $errorColor
    exit 0
}

Write-Host "`nExecuting migrations...`n" -ForegroundColor $infoColor

$successCount = 0
$failCount = 0

foreach ($file in $migrationFiles) {
    Write-Host "[RUNNING] $($file.Name)..." -ForegroundColor $infoColor
    
    # Use Get-Content to pipe SQL file to mysql
    $result = Get-Content $file.FullName | & $mysqlPath -u $username "-p$plainPassword" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[SUCCESS] $($file.Name) completed!`n" -ForegroundColor $successColor
        $successCount++
    } else {
        Write-Host "[FAILED] $($file.Name) failed!" -ForegroundColor $errorColor
        Write-Host "Error: $result`n" -ForegroundColor $errorColor
        $failCount++
    }
}

# Summary
Write-Host "`n========================================" -ForegroundColor $infoColor
Write-Host "  MIGRATION SUMMARY" -ForegroundColor $infoColor
Write-Host "========================================" -ForegroundColor $infoColor
Write-Host "Total migrations: $($migrationFiles.Count)" -ForegroundColor $infoColor
Write-Host "Successful: $successCount" -ForegroundColor $successColor
Write-Host "Failed: $failCount" -ForegroundColor $(if ($failCount -gt 0) { $errorColor } else { $successColor })
Write-Host "========================================`n" -ForegroundColor $infoColor

if ($failCount -eq 0) {
    Write-Host "[SUCCESS] Database setup completed successfully!`n" -ForegroundColor $successColor
    
    # Show tables
    Write-Host "Listing created tables...`n" -ForegroundColor $infoColor
    & $mysqlPath -u $username "-p$plainPassword" -e "USE nexus_db; SHOW TABLES;" 2>&1 | Write-Host
    
    Write-Host "`n[INFO] You can now connect to the database using:" -ForegroundColor $infoColor
    Write-Host "  Database: nexus_db" -ForegroundColor $infoColor
    Write-Host "  Username: $username" -ForegroundColor $infoColor
    Write-Host "`n"
} else {
    Write-Host "[WARNING] Some migrations failed. Please check the errors above.`n" -ForegroundColor $errorColor
}

# Clear password from memory
$plainPassword = $null
[System.GC]::Collect()

Read-Host "Press Enter to exit"
