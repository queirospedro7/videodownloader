@echo off
chcp 65001 >nul
title Downloader

echo.
echo  ╔══════════════════════════════════════╗
echo  ║           DOWNLOADER v2.0            ║
echo  ╚══════════════════════════════════════╝
echo.

:: ── Verificar Python ──────────────────────────────────────────────
python --version >nul 2>&1
if errorlevel 1 (
    echo  [ERRO] Python nao encontrado.
    echo  Corre primeiro o install.bat
    echo.
    pause
    exit /b 1
)

:: ── Verificar dependencias ────────────────────────────────────────
python -c "import flask, yt_dlp, imageio_ffmpeg" >nul 2>&1
if errorlevel 1 (
    echo  [ERRO] Dependencias em falta.
    echo  Corre primeiro o install.bat
    echo.
    pause
    exit /b 1
)

:: ── Iniciar servidor ──────────────────────────────────────────────
echo  [OK] A iniciar servidor em http://localhost:5000
echo  [OK] A abrir browser...
echo.
echo  Para parar o servidor fecha esta janela ou prime Ctrl+C
echo.
echo  ──────────────────────────────────────────
echo.

:: Abre o browser apos 1.5s (tempo para o Flask arrancar)
start "" /b cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:5000"

:: Inicia o servidor (bloqueia aqui ate fechar)
python server.py

echo.
echo  Servidor parado.
pause
