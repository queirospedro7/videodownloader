# -*- coding: utf-8 -*-
"""
Downloader backend — Flask + yt-dlp + imageio-ffmpeg (no external FFmpeg needed)
"""
import json
import os
import queue
import re
import threading
import uuid
from pathlib import Path

import imageio_ffmpeg
import yt_dlp
from flask import Flask, Response, jsonify, render_template, request, stream_with_context

app = Flask(__name__)
app.config["JSON_SORT_KEYS"] = False

# Bundled FFmpeg — no installation required
FFMPEG_PATH = imageio_ffmpeg.get_ffmpeg_exe()

# Active download sessions: id -> queue
_sessions: dict[str, queue.Queue] = {}
_sessions_lock = threading.Lock()

DEFAULT_DOWNLOAD_DIR = str(Path.home() / "Downloads")


# ── Helpers ────────────────────────────────────────────────────────────────

def _duration_str(seconds):
    if not seconds:
        return ""
    seconds = int(seconds)
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def _fmt_bytes(b):
    if not b:
        return ""
    for unit in ("B", "KB", "MB", "GB"):
        if b < 1024:
            return f"{b:.1f} {unit}"
        b /= 1024
    return f"{b:.1f} TB"


def _safe_filename(name: str) -> str:
    """Strip characters that are illegal in Windows/Linux filenames."""
    return re.sub(r'[\\/*?:"<>|]', "_", name)


def _base_ydl_opts() -> dict:
    """Common yt-dlp options shared by all calls."""
    return {
        "quiet": True,
        "no_warnings": True,
        "ffmpeg_location": FFMPEG_PATH,
        # Retry network errors
        "retries": 5,
        "fragment_retries": 5,
        "skip_unavailable_fragments": True,
        # Use cookies from browser if available (helps with age-restricted content)
        # "cookiesfrombrowser": ("chrome",),  # uncomment if needed
    }


# ── Routes ─────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/info", methods=["POST"])
def api_info():
    """Return video metadata + all available formats."""
    data = request.get_json(force=True)
    url = (data.get("url") or "").strip()
    if not url:
        return jsonify({"error": "URL vazia"}), 400

    opts = {**_base_ydl_opts(), "skip_download": True}

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except yt_dlp.utils.DownloadError as e:
        msg = str(e)
        # Clean up yt-dlp prefix noise
        msg = re.sub(r"^ERROR:\s*", "", msg)
        return jsonify({"error": msg}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    raw_formats = info.get("formats") or []

    # ── Build video quality map ──────────────────────────────────────────
    video_map: dict[str, dict] = {}

    for f in raw_formats:
        vcodec   = f.get("vcodec", "none") or "none"
        acodec   = f.get("acodec", "none") or "none"
        height   = f.get("height")
        ext      = f.get("ext", "")
        filesize = f.get("filesize") or f.get("filesize_approx")
        tbr      = f.get("tbr") or 0
        fid      = f.get("format_id", "")

        if vcodec == "none" or not height:
            continue

        key = f"{height}p"
        existing = video_map.get(key)

        # Prefer formats with higher bitrate
        if not existing or tbr > (existing.get("tbr") or 0):
            video_map[key] = {
                "label":     key,
                "format_id": fid,
                "ext":       ext,
                "filesize":  _fmt_bytes(filesize),
                "tbr":       tbr,
                "has_audio": acodec != "none",
            }

    # ── Build audio quality map ──────────────────────────────────────────
    audio_map: dict[str, dict] = {}

    for f in raw_formats:
        vcodec = f.get("vcodec", "none") or "none"
        acodec = f.get("acodec", "none") or "none"
        abr    = f.get("abr") or 0
        ext    = f.get("ext", "")
        fid    = f.get("format_id", "")
        filesize = f.get("filesize") or f.get("filesize_approx")

        if vcodec != "none" or acodec == "none" or not abr:
            continue

        key = f"{int(abr)}kbps"
        existing = audio_map.get(key)
        if not existing or abr > (existing.get("abr") or 0):
            audio_map[key] = {
                "label":     key,
                "format_id": fid,
                "ext":       ext,
                "filesize":  _fmt_bytes(filesize),
                "abr":       abr,
            }

    # ── Sort ─────────────────────────────────────────────────────────────
    def _h(k):
        try: return int(k["label"].replace("p", ""))
        except: return 0

    def _a(k):
        try: return int(k["label"].replace("kbps", ""))
        except: return 0

    sorted_video = sorted(video_map.values(), key=_h, reverse=True)
    sorted_audio = sorted(audio_map.values(), key=_a, reverse=True)

    # Always add a "best" option at the top
    sorted_video.insert(0, {
        "label": "Melhor", "format_id": "bestvideo+bestaudio/best",
        "ext": "mp4", "filesize": "", "tbr": 99999,
    })
    sorted_audio.insert(0, {
        "label": "Melhor", "format_id": "bestaudio/best",
        "ext": "mp3", "filesize": "", "abr": 99999,
    })

    return jsonify({
        "title":         info.get("title", "Sem titulo"),
        "uploader":      info.get("uploader") or info.get("channel") or "",
        "duration":      _duration_str(info.get("duration")),
        "thumbnail":     info.get("thumbnail", ""),
        "platform":      info.get("extractor_key", ""),
        "video_formats": sorted_video,
        "audio_formats": sorted_audio,
    })


@app.route("/api/download", methods=["POST"])
def api_download():
    """Start a download; return session_id for SSE progress tracking."""
    data      = request.get_json(force=True)
    url       = (data.get("url") or "").strip()
    format_id = (data.get("format_id") or "bestvideo+bestaudio/best").strip()
    mode      = (data.get("mode") or "video").strip()
    out_dir   = (data.get("out_dir") or DEFAULT_DOWNLOAD_DIR).strip()

    if not url:
        return jsonify({"error": "URL vazia"}), 400

    session_id = str(uuid.uuid4())
    q: queue.Queue = queue.Queue()

    with _sessions_lock:
        _sessions[session_id] = q

    def progress_hook(d: dict):
        status = d.get("status")
        if status == "downloading":
            total      = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            downloaded = d.get("downloaded_bytes", 0)
            pct        = round((downloaded / total * 100) if total else 0, 1)
            speed      = (d.get("_speed_str") or "").strip()
            eta        = (d.get("_eta_str") or "").strip()
            q.put({
                "type":       "progress",
                "pct":        pct,
                "speed":      speed,
                "eta":        eta,
                "downloaded": _fmt_bytes(downloaded),
                "total":      _fmt_bytes(total),
            })
        elif status == "finished":
            q.put({"type": "processing"})

    def run():
        try:
            os.makedirs(out_dir, exist_ok=True)

            # Use a timestamp suffix to guarantee a unique filename every time,
            # so re-downloading the same video never skips or overwrites.
            import time as _time
            ts = int(_time.time())
            outtmpl = os.path.join(out_dir, f"%(title)s [{ts}].%(ext)s")

            opts = {
                **_base_ydl_opts(),
                "outtmpl":         outtmpl,
                "progress_hooks":  [progress_hook],
                "noplaylist":      True,
                # Never skip if file already exists
                "overwrites":      True,
                "no_overwrites":   False,
            }

            if mode == "audio":
                opts["format"] = format_id
                opts["postprocessors"] = [{
                    "key":              "FFmpegExtractAudio",
                    "preferredcodec":   "mp3",
                    "preferredquality": "0",
                }]
            else:
                opts["format"]              = format_id
                opts["merge_output_format"] = "mp4"

            with yt_dlp.YoutubeDL(opts) as ydl:
                ydl.download([url])

            q.put({"type": "done", "out_dir": out_dir})

        except yt_dlp.utils.DownloadError as e:
            msg = re.sub(r"^ERROR:\s*", "", str(e))
            q.put({"type": "error", "message": msg})
        except Exception as e:
            q.put({"type": "error", "message": str(e)})

    threading.Thread(target=run, daemon=True).start()
    return jsonify({"session_id": session_id})


@app.route("/api/progress/<session_id>")
def api_progress(session_id):
    """SSE stream for real-time download progress."""
    with _sessions_lock:
        q = _sessions.get(session_id)

    if q is None:
        def _err():
            yield 'data: {"type":"error","message":"Sessao nao encontrada"}\n\n'
        return Response(_err(), mimetype="text/event-stream")

    @stream_with_context
    def generate():
        yield 'data: {"type":"connected"}\n\n'
        while True:
            try:
                msg = q.get(timeout=30)
                yield f"data: {json.dumps(msg, ensure_ascii=False)}\n\n"
                if msg.get("type") in ("done", "error"):
                    break
            except queue.Empty:
                yield 'data: {"type":"ping"}\n\n'

        with _sessions_lock:
            _sessions.pop(session_id, None)

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


if __name__ == "__main__":
    print(f"FFmpeg: {FFMPEG_PATH}")
    print("Servidor em http://localhost:5000")
    app.run(debug=False, port=5000, threaded=True)
