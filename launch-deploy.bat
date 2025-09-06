@echo off
echo ========================================
echo BeagleMap - Deploy Folder Launcher
echo ========================================
echo.

cd /d "%USERPROFILE%\Desktop\BeagleMap-Deploy"

echo Checking for Python...
python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Python not found. Installing...
    powershell -Command "Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.11.5/python-3.11.5-amd64.exe' -OutFile '%TEMP%\python-installer.exe'"
    "%TEMP%\python-installer.exe" /quiet InstallAllUsers=0 PrependPath=1
    del "%TEMP%\python-installer.exe"
)

echo Starting web server...
echo.
echo BeagleMap will open in your browser shortly.
echo Access at: http://localhost:8000
echo.
echo Press Ctrl+C to stop the server.
echo.

python -m http.server 8000