@echo off
setlocal
cd /d "%~dp0"
node scripts\setup.mjs %*
exit /b %errorlevel%
