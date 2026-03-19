@echo off
title Panel de Publicidad
color 0A
echo.
echo ================================
echo    PANEL DE PUBLICIDAD
echo ================================
echo.
echo Abriendo navegador en modo pantalla completa...
echo Presiona Ctrl+C para detener
echo.

start "" "http://localhost:5173"
timeout /t 2 /nobreak >nul
powershell -Command "Add-Type -MemberDefinition '[DllImport(\"user32.dll\")] public static extern int keybd_event(byte bVk,byte bScan,int dwFlags,int dwExtraInfo);' -Name keybd_event -Namespace Win32; Start-Sleep -m 500; [Win32.keybd_event]::keybd_event(0xFF,0x9,0x1,0); [Win32.keybd_event]::keybd_event(0xFF,0x9,0x2,0)"

:menu
echo.
echo 1. Ver Carrusel (Ctrl+Shift+Delete para Admin)
echo 2. Ir a Admin
echo 3. Recargar pagina
echo 4. Salir
echo.
choice /c 1234 /m "Selecciona una opcion: "

if errorlevel 4 goto end
if errorlevel 3 start "" "http://localhost:5173" && goto menu
if errorlevel 2 start "" "http://localhost:5173/admin" && goto menu
if errorlevel 1 start "" "http://localhost:5173" && goto menu

:end
exit
