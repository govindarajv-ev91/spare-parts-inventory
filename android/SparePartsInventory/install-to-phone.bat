@echo off
setlocal enabledelayedexpansion

echo ============================================
echo  Spare Parts - Install to OPPO Phone
echo ============================================
echo.

set "SDK=%LOCALAPPDATA%\Android\Sdk"
set "ADB=%SDK%\platform-tools\adb.exe"
set "PROJECT=%~dp0"

if not exist "%ADB%" (
    echo ERROR: adb not found. Install Android Studio SDK first.
    pause
    exit /b 1
)

set "APK=%PROJECT%app\build\outputs\apk\release\app-release.apk"
if not exist "%APK%" set "APK=%PROJECT%app\build\outputs\apk\debug\app-debug.apk"
if not exist "%APK%" (
    echo ERROR: No APK found. Build first:
    echo   Gradle -^> app -^> Tasks -^> build -^> assembleRelease
    pause
    exit /b 1
)

echo Checking phone...
"%ADB%" devices
echo.

echo ============================================
echo  ON YOUR OPPO PHONE - ENABLE THESE FIRST:
echo ============================================
echo.
echo  Settings -^> Additional settings -^> Developer options
echo    [ON]  USB debugging
echo    [ON]  USB debugging ^(Security settings^)
echo    [ON]  Install via USB
echo    [ON]  Disable permission monitoring
echo.
echo  Settings -^> Password ^& security -^> System security
echo    [OFF] Verify apps over USB ^(if shown^)
echo.
echo  Settings -^> Privacy -^> Special app access
echo    Install unknown apps -^> Allow for Files app
echo.
echo Connect USB cable. Tap ALLOW on phone.
echo.
pause

echo Trying to allow ADB installs (Oppo fix)...
"%ADB%" shell settings put global verifier_verify_adb_installs 0 2>nul
"%ADB%" shell settings put global package_verifier_enable 0 2>nul

echo Removing old app if possible...
"%ADB%" uninstall com.evinventory.spareparts 2>nul

echo.
echo Installing: %APK%
echo Please watch your PHONE screen - tap ALLOW if asked.
echo.

"%ADB%" install -r -d -g -t "%APK%"
set ERR=%ERRORLEVEL%

if %ERR% EQU 0 (
    echo.
    echo ============================================
    echo  SUCCESS! Open "Spare Parts" on phone.
    echo ============================================
) else (
    echo.
    echo ============================================
    echo  INSTALL BLOCKED BY OPPO SECURITY
    echo ============================================
    echo.
    echo Error code often means: INSTALL_FAILED_VERIFICATION_FAILURE
    echo.
    echo FIX on OPPO phone:
    echo   1. Developer options -^> turn ON "Install via USB"
    echo   2. Developer options -^> turn ON "USB debugging (Security settings)"
    echo   3. Restart phone, reconnect USB, run this script again
    echo.
    echo OR install from Android Studio:
    echo   Select phone at top -^> click green Run button
    echo   ^(Watch phone - tap Allow when popup appears^)
    echo.
)

pause
