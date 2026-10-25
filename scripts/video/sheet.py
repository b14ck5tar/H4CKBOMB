"""Contact sheet of a recording, to pick in/out times for the EDL: python -I scripts/video/sheet.py raw/tv.mp4 [step_s] [from_s] [to_s]
Writes <file>.sheet.jpg next to the video (every `step` seconds, time stamped)."""
import sys, cv2, numpy as np

path = sys.argv[1]
step = float(sys.argv[2]) if len(sys.argv) > 2 else 5
v = cv2.VideoCapture(path)
dur = v.get(cv2.CAP_PROP_FRAME_COUNT) / v.get(cv2.CAP_PROP_FPS)
t0 = float(sys.argv[3]) if len(sys.argv) > 3 else 0
t1 = float(sys.argv[4]) if len(sys.argv) > 4 else dur
ims, t = [], t0
while t < t1:
    v.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
    ok, f = v.read()
    if ok:
        h = 200 if f.shape[1] >= f.shape[0] else 300
        im = cv2.resize(f, (int(f.shape[1] * h / f.shape[0]), h))
        cv2.putText(im, f"{int(t // 60)}:{t % 60:04.1f}", (4, 20), 0, 0.6, (0, 255, 255), 2)
        ims.append(im)
    t += step
cols = 6
while len(ims) % cols:
    ims.append(np.zeros_like(ims[0]))
cv2.imwrite(path + ".sheet.jpg", np.vstack([np.hstack(ims[i:i + cols]) for i in range(0, len(ims), cols)]))
print(f"{path}: {dur:.1f}s, {len(ims)} frames -> {path}.sheet.jpg")
