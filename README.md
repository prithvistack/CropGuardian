# CropGuardian AI

AI-powered crop intelligence and automation for high-value tomato agriculture: a vision pipeline that detects and classifies leaf disease, an economics-aware engine that decides whether (and how much) to spray, and a FastAPI + React stack that ties it to real rover/sensor hardware.

## System overview

```
Photo / camera frame
      │
      ▼
YOLOv8 leaf detection  (src/cropguardian/inference/detector.py)
      │  crop each detected leaf
      ▼
EfficientNetV2-S classification  (src/cropguardian/inference/predictor.py)
      │  disease class + confidence
      ▼
Grad-CAM  →  severity score Sv  (src/cropguardian/inference/gradcam.py)
      │
      ▼
CADRI / EIL decision engine  (pipeline/cadri_engine.py)
      │  combines Sv, classifier confidence, and live DHT22/soil/MQ135
      │  sensor readings against each pathogen's optimal conditions
      ▼
no_spray / light / moderate / full_spray / manual_inspection
      │
      ▼
Arduino bridge  (api/arduino_bridge.py)  →  car_4wd_serial.ino on the rover
```

A parallel, independent flat-threshold engine (`pipeline/warehouse_engine.py`) watches stored-produce warehouse sensors and drives ventilation — separate from the field spray decision above.

- **Detection → classification**: YOLOv8n locates leaves in a full-plant photo; each crop is classified into one of 10 tomato disease classes by a fine-tuned EfficientNetV2-S (98% test accuracy, see [Model performance](#model-performance)).
- **Explainability & severity**: Grad-CAM produces a heatmap per leaf, reduced to a severity score `Sv`.
- **Decision engine**: `pipeline/cadri_engine.py` computes an environmental-risk-aware CADRI score and compares it against an Economic Injury Level (EIL) derived from treatment cost vs. prevented yield loss, per disease. Ambiguous predictions (low confidence, narrow top-2 gap) are flagged for manual inspection instead of an automated spray decision.
- **Actuation**: decisions are translated into spray/fan commands and sent to the rover's microcontroller over a serial bridge, with per-tier cooldowns to avoid re-triggering a spray on every sensor report.
- **Dashboard**: a React SPA (`cropguardian/`) serves as the operator UI — live sensor readings, manual photo upload, camera-feed analysis, rover driving controls, spray history, and a disease library.

## Repository structure

| Path | Contents |
|---|---|
| `src/cropguardian/` | Core library: data loading/splitting, preprocessing, training pipeline, inference (detector, predictor, Grad-CAM, end-to-end pipeline), evaluation |
| `pipeline/` | Decision engines: `cadri_engine.py` (field spray decisions), `warehouse_engine.py` (ventilation) |
| `api/` | FastAPI backend: `main.py` (app + static frontend mount), `arduino_bridge.py` (serial bridge + `/analyze`), `car_router.py`, `camera_router.py`, `warehouse_router.py` |
| `cropguardian/` | React + Vite operator dashboard (see [cropguardian/README.md](cropguardian/README.md)) |
| `car_4wd_serial/` | Arduino sketch (`car_4wd_serial.ino`) for the rover's combined car/sensor/actuator microcontroller |
| `configs/` | Dataset, training, YOLO, and pathogen-parameter (`pathogen_params.json`) configuration |
| `datasets/` | Raw, processed, split, and manifest data assets (gitignored except manifests) |
| `training/` | One-off experiment scripts (PlantVillage split prep, EfficientNetV2-S train/finetune, YOLOv8 leaf detector train) |
| `models/` | Trained model checkpoints and exports (gitignored) |
| `artifacts/` | Generated reports, metrics, confusion matrices (gitignored) |
| `tools/` | Dataset-building utilities |
| `docs/` | Architecture notes |
| `tests/` | Unit and integration tests |
| `notebooks/` | Exploratory analysis |

## Model performance

EfficientNetV2-S, frozen ImageNet backbone, 384×384 input, trained on an 80/10/10 train/val/test split of the PlantVillage tomato subset (10 classes):

- **Test accuracy: 98%** · **macro F1: 0.98** · **weighted F1: 0.98** (1,610 test images)
- Per-class F1 ranges from 0.95 (Early Blight) to 1.00 (Mosaic Virus, Yellow Leaf Curl Virus)
- Full report: `artifacts/cropguardian_v2s_classification_report.txt`; confusion matrix: `artifacts/confusion_matrix.png`

Leaf detection uses a YOLOv8n model fine-tuned on a tomato leaf detection dataset (`artifacts/yolo_leaf_detector/`).

## Running the full stack

**Backend (FastAPI):**

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -e .
uvicorn api.main:app --reload --port 8000
```

The backend also serves the built frontend from `cropguardian/dist/` at `/` (build it first — see below) so the dashboard and API share one origin. There is no authentication on the API itself; it trusts any client on the local network (localhost + RFC1918 private ranges).

**Frontend (dev mode, hot reload):**

```bash
cd cropguardian
npm install
npm run dev
```

Open the printed local URL (usually `http://localhost:5173`). See [cropguardian/README.md](cropguardian/README.md) for frontend-specific details. The dashboard sits behind a client-side password gate (`cropguardian2025`, hardcoded in `src/App.jsx`) — a demo access gate, not real authentication.

**Frontend (production build, served by the backend):**

```bash
cd cropguardian && npm run build
cd .. && uvicorn api.main:app --port 8000
```

## Training

Training is config-driven and selected via `dataset.name` in `configs/training.yaml`:

1. `plantvillage` — transfer learning from ImageNet on the lab-photographed PlantVillage dataset. Produces `models/plantvillage_best.keras` / `models/plantvillage_final.keras`.
2. `tomato_village` — continues training from the PlantVillage checkpoint (never restarts from ImageNet) on the real-world Tomato-Village Variant-a dataset. Produces `models/tomato_village_best.keras` / `models/tomato_village_final.keras`.

Additional stages can be added under `stages` in `configs/training.yaml` and `datasets` in `configs/datasets.yaml` with no source code changes; a stage can continue from an earlier stage's checkpoint via `source_model`.

```bash
python3 train.py
```

The current production model (EfficientNetV2-S, see [Model performance](#model-performance)) was trained standalone via `training/train_efficientnetv2s.py` rather than through this config-driven pipeline — see that script's docstring for details.

## Hardware integration

The rover runs a combined car/sensor/actuator sketch (`car_4wd_serial/car_4wd_serial.ino`) on an Arduino UNO Q. The board's own Arduino Router service owns the microcontroller's serial port exclusively and exposes it as a local TCP passthrough (`127.0.0.1:7500`), which `api/arduino_bridge.py` holds one persistent connection to for the whole backend — sensor readings (temperature, humidity, soil moisture, gas level, fan/pump state) are read continuously in a background thread, and spray/fan/movement commands are written through the same connection.

## API summary

| Endpoint | Purpose |
|---|---|
| `GET /sensors` | Latest cached sensor reading + cooldown state |
| `POST /command` | Send a raw actuator command (spray/fan) |
| `POST /analyze` | Upload a photo → full detect/classify/CADRI pipeline → spray decision |
| `POST /camera/frame`, `GET /camera/frame` | Push/pull the latest live camera frame |
| `POST /camera/analyze` | Run `/analyze`'s pipeline on the latest camera frame |
| `POST /car/move` | Manual rover movement (F/B/L/R/S/+/-) |
| `GET /warehouse/status` | Storage ventilation decision from the latest sensor reading |

## Notes

This project was built as an SIH prototype. Pathogen parameters in `configs/pathogen_params.json` are literature-informed estimates for a decision-support prototype, not calibrated agronomic constants from field trials.
