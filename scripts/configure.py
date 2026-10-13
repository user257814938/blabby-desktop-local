"""Write the ignored local config using an existing Whisper model directory."""
import argparse
import json
from pathlib import Path
import sys

parser = argparse.ArgumentParser()
parser.add_argument("--model", type=Path, required=True)
parser.add_argument("--large", type=Path)
parser.add_argument("--turbo", type=Path)
args = parser.parse_args()
model = args.model.resolve()
if not (model / "model.bin").is_file():
    parser.error("Specify a local faster-whisper directory containing model.bin")
root = Path(__file__).resolve().parents[1]
config = {"python": sys.executable, "libraries": str(root / "python-libs"), "model": str(model)}
config['models'] = {'base': str(model)}
config['selectedModel'] = 'base'
for key, directory in [('large-v3', args.large), ('large-v3-turbo', args.turbo)]:
    if directory:
        directory = directory.resolve()
        if not (directory / 'model.bin').is_file():
            parser.error(f'Missing model.bin for {key}')
        config['models'][key] = str(directory)
(root / "config.json").write_text(json.dumps(config, indent=2), encoding="utf-8")
print("Local config.json created (excluded from Git).")
