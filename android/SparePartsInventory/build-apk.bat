@echo off
echo ============================================
echo  Build Spare Parts APK
echo ============================================
echo.
echo Keep Android Studio OPEN for this script.
echo It uses the Gradle panel equivalent from command line.
echo.

set "PROJECT=%~dp0"
cd /d "%PROJECT%"

if exist "%PROJECT%gradlew.bat" (
    echo Building RELEASE APK...
    call "%PROJECT%gradlew.bat" assembleRelease
    if %ERRORLEVEL% EQU 0 (
        echo.
        echo SUCCESS! APK location:
        echo %PROJECT%app\build\outputs\apk\release\app-release.apk
        echo.
        echo Next: run install-to-phone.bat with USB connected
    ) else (
        echo BUILD FAILED - use Android Studio Gradle method below
    )
) else (
    echo gradlew.bat not found.
    echo.
    echo USE ANDROID STUDIO INSTEAD:
    echo   1. View -^> Tool Windows -^> Gradle
    echo   2. SparePartsInventory -^> app -^> Tasks -^> build
    echo   3. Double-click assembleRelease
    echo.
    echo OR: Build -^> Build APK
)

echo.
pause
