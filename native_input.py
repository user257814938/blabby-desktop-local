"""Windows integration for the app: capture foreground and paste into it."""
import ctypes
from ctypes import wintypes
import json
import sys
import time

# Electron writes UTF-8 to the pipe; Windows' default locale is not UTF-8.
sys.stdin.reconfigure(encoding='utf-8')
sys.stdout.reconfigure(encoding='utf-8')

user32 = ctypes.WinDLL("user32", use_last_error=True)
user32.GetForegroundWindow.restype = wintypes.HWND
user32.IsWindow.argtypes = [wintypes.HWND]
user32.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]
user32.GetAsyncKeyState.argtypes = [ctypes.c_int]
user32.GetAsyncKeyState.restype = ctypes.c_short
ULONG_PTR = ctypes.c_size_t


class Keyboard(ctypes.Structure):
    _fields_ = [("vk", wintypes.WORD), ("scan", wintypes.WORD),
                ("flags", wintypes.DWORD), ("time", wintypes.DWORD), ("extra", ULONG_PTR)]


class Mouse(ctypes.Structure):
    _fields_ = [("dx", wintypes.LONG), ("dy", wintypes.LONG), ("data", wintypes.DWORD),
                ("flags", wintypes.DWORD), ("time", wintypes.DWORD), ("extra", ULONG_PTR)]


class InputUnion(ctypes.Union):
    _fields_ = [("keyboard", Keyboard), ("mouse", Mouse)]


class Input(ctypes.Structure):
    _fields_ = [("type", wintypes.DWORD), ("data", InputUnion)]


user32.SendInput.argtypes = [wintypes.UINT, ctypes.POINTER(Input), ctypes.c_int]
user32.SendInput.restype = wintypes.UINT


def foreground():
    hwnd = user32.GetForegroundWindow()
    pid = wintypes.DWORD()
    if hwnd:
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
    return {"hwnd": int(hwnd or 0), "pid": pid.value}


def check(target):
    if not target or not user32.IsWindow(target["hwnd"]) or foreground() != target:
        raise ValueError("La fenêtre a changé. Le texte reste disponible dans Blabby pour le copier.")


def run(request):
    action = request["action"]
    if action == "capture":
        return {"target": foreground()}
    target = request.get("target")
    check(target)
    if action == "check":
        return {"ok": True}
    if action != "type":
        raise ValueError("Action inconnue")
    deadline = time.monotonic() + 1.5
    while any(user32.GetAsyncKeyState(key) & 0x8000 for key in (0x10, 0x11, 0x12, 0x5B, 0x5C)):
        if time.monotonic() > deadline:
            raise ValueError("Relâchez les touches du clavier, puis copiez le texte depuis Blabby.")
        time.sleep(0.02)
    check(target)
    text = request.get("text")
    if not isinstance(text, str) or len(text) > 100000:
        raise ValueError("Texte invalide")
    encoded = text.encode("utf-16-le")
    units = [int.from_bytes(encoded[i:i+2], "little") for i in range(0, len(encoded), 2)]
    for offset in range(0, len(units), 128):
        check(target)
        chunk = units[offset:offset+128]
        events = (Input * (len(chunk)*2))()
        for index, unit in enumerate(chunk):
            for release in (0, 1):
                event = events[index*2+release]
                event.type = 1
                event.data.keyboard = Keyboard(0, unit, 4 | (2 if release else 0), 0, 0)
        count = user32.SendInput(len(events), events, ctypes.sizeof(Input))
        if count != len(events):
            raise ValueError("Insertion interrompue par Windows. Le texte reste dans Blabby ; une partie peut déjà être insérée.")
    return {"ok": True}


if __name__ == "__main__":
    for line in sys.stdin:
        request = {}
        try:
            request = json.loads(line)
            result = run(request)
        except Exception as error:
            result = {"error": str(error)}
        result['id'] = request.get('id')
        print(json.dumps(result, ensure_ascii=True), flush=True)

