import ftplib
import json
import os
import pathlib
import shutil
import subprocess
import time
import requests

API = os.environ["KAHAL_API_URL"].rstrip("/")
SECRET = os.environ["WORKER_API_SECRET"]
WORKER_ID = os.getenv("WORKER_ID", "infomaniak-1")
IDLE_LIMIT = int(os.getenv("IDLE_SHUTDOWN_SECONDS", "300"))
HEADERS = {"Authorization": f"Bearer {SECRET}", "Content-Type": "application/json"}
WORK = pathlib.Path("/work")

def api(path, payload):
    response = requests.post(f"{API}{path}", headers=HEADERS, data=json.dumps(payload), timeout=60)
    response.raise_for_status()
    return response

def progress(job_id, status, percent, error=None):
    api(f"/api/worker/jobs/{job_id}/progress", {"status": status, "progress": percent, "error": error})

def upload_ftp(config, source, filename):
    ftp_class = ftplib.FTP_TLS if config["secure"] else ftplib.FTP
    with ftp_class() as ftp:
        ftp.connect(config["host"], int(config["port"]), timeout=60)
        ftp.login(config["username"], config["password"])
        if config["secure"]:
            ftp.prot_p()
        for part in config["directory"].replace("\\", "/").split("/"):
            if not part:
                continue
            try:
                ftp.cwd(part)
            except ftplib.error_perm:
                ftp.mkd(part)
                ftp.cwd(part)
        with source.open("rb") as stream:
            ftp.storbinary(f"STOR {filename}", stream, blocksize=1024 * 256)

def delete_ftp(config, filename):
    ftp_class = ftplib.FTP_TLS if config["secure"] else ftplib.FTP
    with ftp_class() as ftp:
        ftp.connect(config["host"], int(config["port"]), timeout=60)
        ftp.login(config["username"], config["password"])
        if config["secure"]:
            ftp.prot_p()
        for part in config["directory"].replace("\\", "/").split("/"):
            if part:
                ftp.cwd(part)
        try:
            ftp.delete(filename)
        except ftplib.error_perm as error:
            if not str(error).startswith("550"):
                raise

def download_youtube(url, job_dir):
    output_template = str(job_dir / "source") + ".%(ext)s"
    # Prefer audio-only. Recently finished livestreams can temporarily expose an empty
    # post-live DASH manifest; in that case format 18/22 provides a progressive fallback.
    formats = ["140-dash/139-dash/bestaudio/best", "18/22/best[acodec!=none]"]
    errors = []
    for format_selector in formats:
        for old_file in job_dir.glob("source.*"):
            old_file.unlink(missing_ok=True)
        command = [
            "yt-dlp", "--no-playlist", "--no-part", "--js-runtimes", "deno",
            "-f", format_selector, "-o", output_template, url,
        ]
        result = subprocess.run(command, check=False)
        candidates = [path for path in job_dir.glob("source.*") if path.is_file() and path.stat().st_size > 0]
        if result.returncode == 0 and candidates:
            return candidates[0]
        errors.append(f"Format {format_selector}: Exit-Code {result.returncode}")
    raise RuntimeError("YouTube-Download fehlgeschlagen; " + "; ".join(errors))

def process(job):
    job_dir = WORK / str(job["id"])
    shutil.rmtree(job_dir, ignore_errors=True)
    job_dir.mkdir(parents=True)
    output = job_dir / "converted.mp3"
    try:
        if job.get("operation") == "delete":
            if not job.get("filename"):
                raise RuntimeError("Dateiname für FTP-Löschung fehlt")
            progress(job["id"], "processing", 50)
            delete_ftp(job["ftp"], job["filename"])
            api(f"/api/worker/jobs/{job['id']}/complete", {"deleted": True})
            return
        progress(job["id"], "processing", 10)
        downloaded = download_youtube(job["youtubeUrl"], job_dir)
        progress(job["id"], "processing", 45)
        duration = float(job["endSeconds"]) - float(job["startSeconds"])
        subprocess.run(["ffmpeg", "-hide_banner", "-y", "-ss", str(job["startSeconds"]), "-i", str(downloaded), "-t", str(duration), "-vn", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-codec:a", "libmp3lame", "-b:a", "128k", "-metadata", f"title={job['title']}", str(output)], check=True)
        filename = f"{int(time.time())}.mp3"
        timestamped_output = job_dir / filename
        output.rename(timestamped_output)
        output = timestamped_output
        progress(job["id"], "uploading", 75)
        upload_ftp(job["ftp"], output, filename)
        api(f"/api/worker/jobs/{job['id']}/complete", {"filename": filename, "bytes": output.stat().st_size, "durationSeconds": round(duration)})
    except Exception as error:
        try:
            progress(job["id"], "failed", 0, str(error)[:4000])
        except Exception:
            pass
    finally:
        shutil.rmtree(job_dir, ignore_errors=True)

idle_since = time.time()
while True:
    response = requests.post(f"{API}/api/worker/jobs/claim", headers=HEADERS, data=json.dumps({"workerId": WORKER_ID}), timeout=60)
    if response.status_code == 204:
        if time.time() - idle_since >= IDLE_LIMIT:
            break
        time.sleep(15)
        continue
    response.raise_for_status()
    idle_since = time.time()
    process(response.json())
