import os, sys, json, socket, time, io, base64, gc
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
sys.stdout.reconfigure(encoding='utf-8')
sys.stdin.reconfigure(encoding='utf-8')
config = json.load(open(sys.argv[1], encoding='utf-8-sig'))
sys.path.insert(0, config['libraries'])
from faster_whisper import WhisperModel
# No network is needed or permitted by this worker, including localhost.
def reject_network(*args, **kwargs):
    raise RuntimeError('Network disabled in local transcription worker')
socket.socket.connect = reject_network
socket.socket.connect_ex = reject_network
models = config.get('models', {'base': config['model']})
selected = config.get('selectedModel', 'base')
def load_model(key):
    return WhisperModel(models[key], device='cpu', compute_type='int8',
                        local_files_only=True, cpu_threads=min(6, os.cpu_count() or 2))
model = load_model(selected)
print(json.dumps({'ready': True, 'model': selected}), flush=True)
for line in sys.stdin:
    request = {}
    try:
        request = json.loads(line)
        if request.get('action') == 'model':
            key = request['model']
            if key not in models:
                raise ValueError('Modèle inconnu')
            if key != selected:
                previous = selected
                del model
                gc.collect()
                try:
                    model = load_model(key)
                except Exception:
                    model = load_model(previous)
                    raise
                selected = key
            print(json.dumps({'id': request['id'], 'model': selected}), flush=True)
            continue
        started = time.perf_counter()
        audio = io.BytesIO(base64.b64decode(request['audio'], validate=True))
        segments, info = model.transcribe(audio, language=request.get('language') or None,
                                          beam_size=3, vad_filter=True,
                                          condition_on_previous_text=False)
        text = ' '.join(s.text.strip() for s in segments).strip()
        result = {'id': request['id'], 'text': text, 'language': info.language,
                  'duration': info.duration, 'elapsed': time.perf_counter()-started, 'model': selected}
    except Exception as exc:
        result = {'id': request.get('id'), 'error': str(exc)}
    print(json.dumps(result, ensure_ascii=False), flush=True)
