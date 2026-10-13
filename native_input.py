"""Windows integration for the app: capture foreground and paste into it."""
import ctypes
from ctypes import wintypes
import json
import sys
import time

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
    if action != "paste":
        raise ValueError("Action inconnue")
    deadline = time.monotonic() + 1.5
    while any(user32.GetAsyncKeyState(key) & 0x8000 for key in (0x10, 0x11, 0x12, 0x5B, 0x5C)):
        if time.monotonic() > deadline:
            raise ValueError("Relâchez les touches du clavier, puis copiez le texte depuis Blabby.")
        time.sleep(0.02)
    check(target)
    events = (Input * 4)()
    for event, (key, flags) in zip(events, [(0x11, 0), (0x56, 0), (0x56, 2), (0x11, 2)]):
        event.type = 1
        event.data.keyboard = Keyboard(key, 0, flags, 0, 0)
    count = user32.SendInput(4, events, ctypes.sizeof(Input))
    if count != 4:
        # Release our injected keys even if Windows refused some events.
        release = (Input * 2)()
        for event, key in zip(release, (0x56, 0x11)):
            event.type = 1
            event.data.keyboard = Keyboard(key, 0, 2, 0, 0)
        user32.SendInput(2, release, ctypes.sizeof(Input))
        raise ValueError("Windows a refusé le collage. Copiez le texte depuis Blabby.")
    return {"ok": True}


if __name__ == "__main__":
    try:
        result = run(json.load(sys.stdin))
    except Exception as error:
        result = {"error": str(error)}
    print(json.dumps(result, ensure_ascii=True), flush=True)
