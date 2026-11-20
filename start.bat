@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Download the LTS version from https://nodejs.org and run this again. & pause & exit /b 1)
if not exist node_modules (echo Installing - first run only, takes a minute... & call npm install --no-audit --no-fund)
if not exist dist (echo Building the interface... & call npm run build)
start "" http://localhost:3000
echo.
echo Outreach Mailer is running. Keep this window open - closing it stops scheduled sending.
echo.
node server/index.js
pause
