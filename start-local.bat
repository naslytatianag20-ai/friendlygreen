@echo off
REM FriendlyGreen - arranque local con MySQL XAMPP (Backend 4000 + Frontend 5173)
set PATH=%PATH%;C:\Program Files\nodejs
echo Verificando MySQL XAMPP...
C:\xampp\mysql\bin\mysql.exe -u root -e "SELECT 1" >nul 2>&1
if errorlevel 1 (
  echo [ERROR] MySQL no responde. Abre XAMPP Control Panel e inicia MySQL.
  pause
  exit /b 1
)
cd backend
if not exist node_modules call npm install
call npm run migrate
start "FriendlyGreen API" cmd /k "node server.js"
cd ..\frontend
if not exist node_modules call npm install
timeout /t 4 >nul
start "FriendlyGreen Web" cmd /k "npm run dev"
echo.
echo API: http://localhost:4000/api/health  (db=mysql)
echo Web: http://localhost:5173  (demo@friendlygreen.co / demo123)
echo phpMyAdmin: http://localhost/phpmyadmin  (base friendlygreen)
pause
