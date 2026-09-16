@echo off
setlocal
title Project 1436 - Dataview Documentation Generator

cd /d "%~dp0"

echo ===================================================
echo     Dataview Documentation Generator (TypeDoc/JSDoc)
echo ===================================================
echo.

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed or not found in PATH.
    pause
    exit /b 1
)

echo [INFO] Generating HTML documentation into docs\...
echo.

call npx typedoc --out docs core --entryPointStrategy expand --exclude "**/*.worker.ts" --tsconfig tsconfig.app.json

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Documentation generation failed with code %ERRORLEVEL%.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ===================================================
echo [SUCCESS] Documentation generated in docs\
echo ===================================================
echo.
if /i not "%~1"=="--no-pause" (
    pause
)
exit /b 0
