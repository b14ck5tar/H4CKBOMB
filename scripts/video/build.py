"""Build the Meta-track video from devpost-media/video/edl.json with ffmpeg (pip install imageio-ffmpeg).

    python -I scripts/video/build.py            # full cut -> devpost-media/video/out/group-project.mp4
    python -I scripts/video/build.py --only d5  # render just one beat (fast check of a new shot)

The EDL is a list of beats. A beat has one voiceover line (vo/<id>.wav, made by scripts/video/vo.mjs) and the shots
that play under it; the beat lasts as long as its line (+ pad), or `min` seconds. Shot types:
  {"src": video, "in": sec, "crop": [x,y,w,h], "dur": sec}   a clip (crop optional; fit inside 16:9 over a blur)
  {"img": still, "zoom": 1.08}                               a still with a slow push in
  {"ph": "S5 friend's idea +1"}                              a labelled placeholder until the footage exists
  {"card": "title" | "end"}                                  the title / end card
The last shot of a beat fills what is left. Segments are cached by their spec, so a rebuild only re-renders changes.
Missing source files fall back to a placeholder, so the cut always builds.
"""
import hashlib, json, os, re, shutil, subprocess, sys, textwrap, wave

import imageio_ffmpeg

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
VID = os.path.join(ROOT, "devpost-media", "video")
WORK = os.path.join(VID, "cache")
OUT = os.path.join(VID, "out")
FF = imageio_ffmpeg.get_ffmpeg_exe()
W, H, FPS = 1920, 1080, 30
BG = "0x0b0712"
LOW = 0x00004000 if os.name == "nt" else 0  # BELOW_NORMAL_PRIORITY_CLASS: other sessions are running games
FONT_CAP = "C:/Windows/Fonts/segoeuib.ttf"
FONT_TITLE = "C:/Windows/Fonts/impact.ttf"
CHIPS = {"hook": None, "problem": "Human connection", "demo": "Working demo", "reveal": "Based on a true story",
         "ai": "AI at the core", "tools": "How we built it", "end": None}


def run(args):
    r = subprocess.run([FF, "-hide_banner", "-loglevel", "error", "-y", *args], cwd=WORK, creationflags=LOW,
                       capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"ffmpeg failed:\n{' '.join(args)[:2000]}\n{r.stderr[-3000:]}")


def wav_len(path):
    with wave.open(path) as w:
        return w.getnframes() / w.getframerate()


def p(rel):
    return os.path.join(ROOT, rel) if rel and not os.path.isabs(rel) else rel


def txt(name, s):
    """drawtext reads text from a file in WORK (no escaping trouble)."""
    with open(os.path.join(WORK, name), "w", encoding="utf-8", newline="\n") as f:  # a CR would draw as a blank line
        f.write(s)
    return name


def font(path):
    name = os.path.basename(path)
    if not os.path.exists(os.path.join(WORK, name)):
        shutil.copy(path, os.path.join(WORK, name))
    return name


BAND = 860  # footage fits above this line; the caption band (and chip) sits below it, clear of the game's own text


def overlays(seg, beat, chip):
    """Caption centred in the band under the footage, the criterion chip at the band's top-left."""
    f = []
    cap = beat.get("caption", beat.get("vo", ""))
    if cap:
        lines = textwrap.wrap(cap, 70)
        tf = txt(f"{seg}.cap.txt", "\n".join(lines))
        f.append(f"drawtext=fontfile={font(FONT_CAP)}:textfile={tf}:fontsize=42:fontcolor=white:line_spacing=12:"
                 f"text_align=C:x=(w-text_w)/2:y={BAND}+({H}-{BAND}-text_h)/2+8")
    if chip:
        tf = txt(f"{seg}.chip.txt", chip.upper())
        f.append(f"drawtext=fontfile={font(FONT_CAP)}:textfile={tf}:fontsize=22:fontcolor=0x0b0712:x=36:y={BAND}+14:"
                 f"box=1:boxcolor=0x7cf7d4@0.95:boxborderw=8")
    return f


def framed(cap):
    """[pic] (1920x1080) -> blurred fill + the picture fitted above the caption band + the band."""
    if not cap:
        return "[pic]null"
    return (f"[pic]split[fa][fb];[fa]gblur=sigma=40,eq=brightness=-0.22[fbg];[fb]scale={W}:{BAND}:force_original_aspect_ratio=decrease[ffg];"
            f"[fbg][ffg]overlay=(W-w)/2:({BAND}-h)/2,drawbox=x=0:y={BAND}:w={W}:h={H - BAND}:color={BG}@1:t=fill,"
            f"drawbox=x=0:y={BAND}:w={W}:h=3:color=0xff4fa3@0.9:t=fill")


def card_filter(kind, seg, dur):
    """The title and end cards: the paint-splat logo over the dark table colour, plus text."""
    logo = p("game/public/logo-group-project.jpg")
    ft = font(FONT_TITLE)
    fc = font(FONT_CAP)
    if kind == "title":
        t1 = txt(f"{seg}.t1.txt", "BASED ON A TRUE STORY")
        return ([ "-f", "lavfi", "-t", str(dur), "-i", f"color=c={BG}:s={W}x{H}:r={FPS}", "-loop", "1", "-t", str(dur), "-i", logo],
                f"[1:v]scale=1300:-1,format=rgba,colorkey=black:0.18:0.12[l];[0:v][l]overlay=(W-w)/2:40[v0];"
                f"[v0]drawtext=fontfile={ft}:textfile={t1}:fontsize=84:fontcolor=0xffd23f:x=(w-text_w)/2:y=h-230,"
                f"fade=t=in:st=0:d=0.4")
    t1 = txt(f"{seg}.t1.txt", "PLAY FREE AT")
    t2 = txt(f"{seg}.t2.txt", "groupproject-game.vercel.app")
    qr = os.path.join(VID, "stills", "qr.png")
    inputs = ["-f", "lavfi", "-t", str(dur), "-i", f"color=c={BG}:s={W}x{H}:r={FPS}", "-loop", "1", "-t", str(dur), "-i", logo]
    fg = (f"[1:v]scale=1000:-1,format=rgba,colorkey=black:0.18:0.12[l];[0:v][l]overlay=120:110[v0];"
          f"[v0]drawtext=fontfile={ft}:textfile={t1}:fontsize=70:fontcolor=0x7cf7d4:x=150:y=h-330,"
          f"drawtext=fontfile={fc}:textfile={t2}:fontsize=92:fontcolor=white:x=150:y=h-245")
    if os.path.exists(qr):
        inputs += ["-loop", "1", "-t", str(dur), "-i", qr]
        fg += f"[v1];[2:v]scale=520:520[q];[v1][q]overlay=W-w-150:(H-h)/2-60"
    return inputs, fg + ",fade=t=in:st=0:d=0.4"


EDL = {}


def render_shot(shot, dur, beat, chip, seg, vol):
    out = f"{seg}.mp4"
    if "pair" in shot:  # the TV and the phone side by side from the two raw recordings, synced by phoneOffset
        tv, ph = p(EDL.get("tv", "")), p(EDL.get("phone", ""))
        if not (os.path.exists(tv) and os.path.exists(ph)):
            shot = {"ph": shot.get("ph") or "TV + PHONE"}
        else:
            shot = dict(shot, src=tv, _phone=ph, _pin=shot["pair"] + EDL.get("phoneOffset", 0), **{"in": shot["pair"]})
    src = p(shot.get("src")) if shot.get("src") else None
    img = p(shot.get("img")) if shot.get("img") else None
    if (src and not os.path.exists(src)) or (img and not os.path.exists(img)):
        shot = {"ph": shot.get("ph") or f"MISSING {os.path.basename(src or img)}"}
        src = img = None
    ov = overlays(seg, beat, chip)
    cap = beat.get("caption", beat.get("vo", ""))
    audio = ["-f", "lavfi", "-t", str(dur), "-i", "anullsrc=r=48000:cl=stereo"]
    if src:
        crop = "crop={2}:{3}:{0}:{1},".format(*shot["crop"]) if shot.get("crop") else ""
        speed = shot.get("speed", 1)
        inputs = ["-ss", str(shot.get("in", 0)), "-t", str(dur * speed + 0.2), "-i", src]
        if shot.get("_phone"):
            pc = EDL.get("phoneCrop")
            pcrop = "crop={2}:{3}:{0}:{1},".format(*pc) if pc else ""
            inputs += ["-ss", str(max(0, shot["_pin"])), "-t", str(dur + 0.2), "-i", shot["_phone"]]
            fg = (f"[0:v]{crop}fps={FPS},scale=1440:{BAND - 40}:force_original_aspect_ratio=decrease[t];"
                  f"[1:v]{pcrop}fps={FPS},scale=-2:{BAND - 30}[ph];"
                  f"color=c={BG}:s={W}x{H}:r={FPS}:d={dur}[base];[base][t]overlay=36:({BAND}-h)/2[b1];"
                  f"[b1][ph]overlay=W-w-44:({BAND}-h)/2,"
                  f"drawbox=x=0:y={BAND}:w={W}:h=3:color=0xff4fa3@0.9:t=fill")
        else:
          fg = (f"[0:v]{crop}setpts=PTS/{speed},fps={FPS},split[a][b];"
              f"[a]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},gblur=sigma=40,eq=brightness=-0.18[bg0];"
              f"[b]scale={W}:{H}:force_original_aspect_ratio=decrease[fg0];[bg0][fg0]overlay=(W-w)/2:(H-h)/2[pic];" + framed(cap))
        has_audio = vol > 0
        if has_audio:
            atempo = f",atempo={speed}" if speed != 1 else ""
            afilter = f"[0:a]aresample=48000,volume={vol}{atempo},apad,atrim=0:{dur}[ao]"
    elif img:
        z = shot.get("zoom", 1.06)
        n = int(dur * FPS)
        inputs = ["-i", img]
        fg = (f"[0:v]scale={W*2}:{H*2}:force_original_aspect_ratio=increase,crop={W*2}:{H*2},"
              f"zoompan=z='1+({z}-1)*on/{n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={n}:s={W}x{H}:fps={FPS}[pic];" + framed(cap))
        has_audio = False
    elif shot.get("card"):
        inputs, fg = card_filter(shot["card"], seg, dur)
        has_audio = False
    else:
        label = txt(f"{seg}.ph.txt", shot["ph"])
        sub = txt(f"{seg}.sub.txt", "PLACEHOLDER: new footage drops in here")
        inputs = ["-f", "lavfi", "-t", str(dur), "-i", f"color=c=0x1d1030:s={W}x{H}:r={FPS}"]
        fg = (f"[0:v]drawtext=fontfile={font(FONT_TITLE)}:textfile={label}:fontsize=96:fontcolor=0xff4fa3:x=(w-text_w)/2:y=h*0.34,"
              f"drawtext=fontfile={font(FONT_CAP)}:textfile={sub}:fontsize=34:fontcolor=white@0.7:x=(w-text_w)/2:y=h*0.34+130[pic];" + framed(cap))
        has_audio = False
    n_in = sum(1 for a in inputs if a == "-i")
    fg += ("," + ",".join(ov) if ov else "") + f",fade=t=in:st=0:d=0.12,format=yuv420p[vo]"
    args = [*inputs, *audio]
    if has_audio:
        fg += ";" + afilter
        amap = "[ao]"
    else:
        amap = f"{n_in}:a"
    args += ["-filter_complex", fg, "-map", "[vo]", "-map", amap, "-t", str(dur), "-r", str(FPS),
             "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-pix_fmt", "yuv420p",
             "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", out]
    run(args)
    return out


def main():
    os.makedirs(WORK, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    edl_path = sys.argv[sys.argv.index("--edl") + 1] if "--edl" in sys.argv else os.path.join(VID, "edl.json")
    edl = json.load(open(edl_path, encoding="utf-8"))
    EDL.update(edl)
    only = sys.argv[sys.argv.index("--only") + 1] if "--only" in sys.argv else None
    segs, vo_marks, t = [], [], 0.0
    for beat in edl["beats"]:
        vo_path = os.path.join(VID, "vo", f"{beat['id']}.wav")
        words = len(re.findall(r"\w+", beat.get("vo", "")))
        vo_len = wav_len(vo_path) if os.path.exists(vo_path) else (words / 2.6 if words else 0)
        lead = beat.get("lead", 0.25)
        dur = max(beat.get("min", 0), lead + vo_len + beat.get("pad", 0.5) if vo_len else 0)
        chip = CHIPS.get(beat.get("part"))
        vol = beat.get("gameVol", 0.0 if beat.get("vo") else 0.8)
        if only and beat["id"] != only:
            t += dur
            continue
        if os.path.exists(vo_path):
            vo_marks.append((t + lead, vo_path))
        shots, left = beat["shots"], dur
        for i, shot in enumerate(shots):
            d = left if i == len(shots) - 1 else min(shot["dur"], left)
            left -= d
            if d <= 0.05:
                continue
            extra = [EDL.get("tv"), EDL.get("phone"), EDL.get("phoneOffset"), EDL.get("phoneCrop")] if "pair" in shot else []
            spec = json.dumps([shot, d, beat.get("caption", beat.get("vo")), chip, vol, extra], sort_keys=True)
            seg = f"{beat['id']}_{i}_" + hashlib.md5(spec.encode()).hexdigest()[:8]
            if not os.path.exists(os.path.join(WORK, f"{seg}.mp4")):
                print(f"render {seg} ({d:.1f}s)", flush=True)
                render_shot(shot, round(d, 3), beat, chip, seg, vol)
            segs.append(f"{seg}.mp4")
        print(f"{beat['id']:>4} {t:6.1f}s  {dur:4.1f}s  {beat.get('vo', '')[:60]}")
        t += dur
    print(f"total {t:.1f}s ({int(t // 60)}:{t % 60:04.1f})")
    with open(os.path.join(WORK, "list.txt"), "w") as f:
        f.writelines(f"file '{s}'\n" for s in segs)
    run(["-f", "concat", "-safe", "0", "-i", "list.txt", "-c", "copy", "picture.mp4"])
    # Voice: each line placed at its beat; de-essed, gentle low-pass (the harsh S), limited to -2 dBTP (no crackle).
    name = edl.get("out", "group-project") + ("-" + only if only else "")
    final = os.path.join(OUT, f"{name}.mp4")
    if vo_marks:
        ins, chains = ["-i", "picture.mp4"], []
        for k, (at, path) in enumerate(vo_marks):
            ins += ["-i", path]
            chains.append(f"[{k+1}:a]aresample=48000,aformat=channel_layouts=stereo,adelay={int(at*1000)}:all=1[v{k}]")
        mix = "".join(f"[v{k}]" for k in range(len(vo_marks)))
        fg = (";".join(chains) + f";{mix}amix=inputs={len(vo_marks)}:normalize=0,"
              "highpass=f=80,deesser=i=0.45:m=0.5:f=0.5,lowpass=f=11000,volume=1.0,asplit[vo][sc];"
              "[0:a]volume=0.9[game];[game][sc]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=350[duck];"
              "[duck][vo]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-2:LRA=11,alimiter=limit=0.79[a]")
        run([*ins, "-filter_complex", fg, "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
             "-ar", "48000", "-movflags", "+faststart", final])
    else:
        run(["-i", "picture.mp4", "-c", "copy", "-movflags", "+faststart", final])
    print("wrote", os.path.relpath(final, ROOT))


if __name__ == "__main__":
    main()
