@echo off
setlocal

echo ============================================
echo  Clean Android Build (fix locked files)
echo ============================================
echo.

set "PROJECT=%~dp0"
cd /d "%PROJECT%"

echo Step 1: Stopping Gradle daemons...
where gradle >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    gradle --stop
) else (
    echo Gradle not in PATH - stopping Java build processes...
    taskkill /F /IM java.exe /T >nul 2>&1
)

timeout /t 3 /nobreak >nul

echo Step 2: Deleting build folders...
if exist "%PROJECT%app\build" (
    rmdir /s /q "%PROJECT%app\build" 2>nul
    if exist "%PROJECT%app\build" (
        echo Retrying with PowerShell...
        powershell -NoProfile -Command "Start-Sleep -Seconds 2; Remove-Item -LiteralPath '%PROJECT%app\build' -Recurse -Force -ErrorAction SilentlyContinue"
    )
)

if exist "%PROJECT%build" (
    rmdir /s /q "%PROJECT%build" 2>nul
)

if exist "%PROJECT%.gradle" (
    echo Keeping .gradle cache (only removing build outputs)
)

if exist "%PROJECT%app\build" (
    echo.
    echo WARNING: Could not fully delete app\build
    echo Please CLOSE Android Studio completely, then run this script again.
) else (
    echo.
    echo SUCCESS: Build folders deleted.
    echo Now open Android Studio and click Build -^> Rebuild Project
)

echo.
pause
