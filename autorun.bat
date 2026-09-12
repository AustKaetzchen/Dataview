@echo off
setlocal
title Project 1436 - Dataview Webviewer

:: Change to the directory where this script is located
cd /d "%~dp0"

echo ===================================================
echo           Starting Dataview Webviewer              
echo ===================================================
echo.

:: Verify Node.js is available
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed or not found in PATH.
    echo Please install Node.js from https://nodejs.org/ and try again.
    echo.
    pause
    exit /b 1
)

:: Check if node_modules exists, install if missing
if not exist "node_modules\" (
    echo [INFO] node_modules directory not found. Installing dependencies...
    echo.
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo.
        echo [ERROR] Failed to install dependencies.
        pause
        exit /b %ERRORLEVEL%
    )
    echo.
)

:: Check if a forced rebuild was requested via argument (e.g. autorun.bat build)
if /i "%~1"=="build" goto do_build
if /i "%~1"=="rebuild" goto do_build
if /i "%~1"=="--build" goto do_build

:: Check if dist bundle exists, build if missing
if not exist "dist\index.html" (
    echo [INFO] Production build not found. Generating build...
    goto do_build
)

goto start_preview

:do_build
echo [INFO] Building production bundle...
echo.
call npm run build
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Build failed.
    pause
    exit /b %ERRORLEVEL%
)
echo.

:start_preview
:: Launch the fast preview server for the pre-built version
echo [INFO] Launching built webviewer in your browser...
echo [INFO] (Press Ctrl+C in this window to stop the server)
echo.
call npm run preview -- --host --open

:: If the server exits with an error, keep window open
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] The server exited with error code %ERRORLEVEL%.
    pause
)
