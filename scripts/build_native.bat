@echo off
setlocal enabledelayedexpansion

echo [build_native] Searching for MSVC 64-bit environment...

set "VCVARS="
if exist "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" (
  set "VCVARS=C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
) else if exist "C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" (
  set "VCVARS=C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
) else if exist "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" (
  set "VCVARS=C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat"
) else if exist "C:\Program Files (x86)\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" (
  set "VCVARS=C:\Program Files (x86)\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat"
)

if "%VCVARS%"=="" (
  echo [build_native] ERROR: Could not find vcvars64.bat!
  exit /b 1
)

echo [build_native] Initializing MSVC environment via %VCVARS%
call "%VCVARS%" >nul 2>&1
if errorlevel 1 (
  echo [build_native] ERROR: Failed to initialize vcvars64.bat
  exit /b 1
)

if not exist bin mkdir bin

echo [build_native] Compiling core\framework\native\raster_reader.c with /O2 /openmp /arch:AVX2 ...
cl /nologo /O2 /arch:AVX2 /openmp /W3 /Fe:bin\raster_reader.exe /Fo:bin\raster_reader.obj core\framework\native\raster_reader.c

if errorlevel 1 (
  echo [build_native] ERROR: Compilation failed!
  exit /b 1
)

if exist bin\raster_reader.obj del bin\raster_reader.obj

echo [build_native] SUCCESS: Successfully built bin\raster_reader.exe
exit /b 0
