# Downloader

Interface web minimalista para download de videos e audios.  
Suporta YouTube, Vimeo, Twitter/X, Instagram, TikTok, Facebook, SoundCloud e [centenas mais](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md).

## Requisitos

- Python 3.9+
- [FFmpeg](https://ffmpeg.org/download.html) no PATH (necessario para audio MP3 e merge de streams 1080p+)

## Instalacao

```bash
python -m pip install -r requirements.txt
```

## Uso

```bash
python server.py
```

Abre o browser em **http://localhost:5000**

## Funcionalidades

- Todas as qualidades disponiveis do video (detectadas automaticamente)
- Download de audio em MP3
- Progresso em tempo real (velocidade, ETA, tamanho)
- Interface dark minimalista com animacoes
- Suporte a centenas de plataformas
