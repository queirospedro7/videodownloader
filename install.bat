@echo off
chcp 65001 >nul
title Downloader — Instalacao

echo.
echo  ╔══════════════════════════════════════╗
echo  ║        DOWNLOADER  Instalacao        ║
echo  ╚══════════════════════════════════════╝
echo.

:: ── Verificar Python ──────────────────────────────────────────────
python --version >nul 2>&1
if errorlevel 1 (
    echo  [ERRO] Python nao encontrado.
    echo.
    echo  Instala o Python em: https://www.python.org/downloads/
    echo  Certifica-te de marcar "Add Python to PATH" durante a instalacao.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('python --version 2^>^&1') do set PY_VER=%%v
echo  [OK] %PY_VER% encontrado
echo.

:: ── Atualizar pip ─────────────────────────────────────────────────
echo  [1/3] A atualizar pip...
python -m pip install --upgrade pip --quiet
if errorlevel 1 (
    echo  [AVISO] Nao foi possivel atualizar o pip. A continuar...
)
echo  [OK] pip atualizado
echo.

:: ── Instalar dependencias ─────────────────────────────────────────
echo  [2/3] A instalar dependencias...
echo        flask, yt-dlp, imageio-ffmpeg
echo.
python -m pip install -r requirements.txt
if errorlevel 1 (
    echo.
    echo  [ERRO] Falha ao instalar dependencias.
    echo  Tenta correr manualmente: python -m pip install -r requirements.txt
    echo.
    pause
    exit /b 1
)
echo.
echo  [OK] Dependencias instaladas
echo.

:: ── Verificar instalacao ──────────────────────────────────────────
echo  [3/3] A verificar instalacao...
python -c "import flask, yt_dlp, imageio_ffmpeg; import importlib.metadata as m; fv=m.version('flask'); print('  [OK] flask ' + fv); print('  [OK] yt-dlp ' + yt_dlp.version.__version__); print('  [OK] ffmpeg em ' + imageio_ffmpeg.get_ffmpeg_exe())" 2>nul
if errorlevel 1 (
    echo  [ERRO] Verificacao falhou. Algo correu mal na instalacao.
    pause
    exit /b 1
)
echo.

:: ── Sucesso ───────────────────────────────────────────────────────
echo  ╔══════════════════════════════════════╗
echo  ║   Instalacao concluida com sucesso!  ║
echo  ╚══════════════════════════════════════╝
echo.
echo  Para iniciar a aplicacao, executa:
echo.
echo     start.bat
echo.
echo  Ou manualmente:
echo     python server.py
echo.
pause
