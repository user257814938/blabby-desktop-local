"""Write the ignored local config using an existing Whisper model directory."""
import argparse
import json
from pathlib import Path
import sys

parser = argparse.ArgumentParser()
parser.add_argument("--model", type=Path, required=True)
args = parser.parse_args()
model = args.model.resolve()
if not (model / "model.bin").is_file():
    parser.error("Specify a local faster-whisper directory containing model.bin")
root = Path(__file__).resolve().parents[1]
config = {"python": sys.executable, "libraries": str(root / "python-libs"), "model": str(model)}
(root / "config.json").write_text(json.dumps(config, indent=2), encoding="utf-8")
print("Local config.json created (excluded from Git).")
