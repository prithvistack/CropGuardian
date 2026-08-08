# Tomato leaf detection dataset

Built by `tools/build_leaf_detection_dataset.py` from the PlantDoc Object
Detection Dataset (all 9 tomato classes, healthy + diseased, disease label
discarded). Single class: `tomato_leaf` — this stage only locates and crops
leaves out of full-plant images; disease classification happens downstream
in the EfficientNetV2 stage (`training/train_efficientnetv2s.py`).

746 tomato images / 2,932 boxes, split 80:10:10 (597 train / 75 val / 74
test), seed 42. Filenames are prefixed `pd_train_`/`pd_test_` for their
PlantDoc source split (unrelated to our own train/val/test split) to avoid
basename collisions between PlantDoc's two folders.

Layout:

```
images/{train,val,test}/*.jpg
labels/{train,val,test}/*.txt   # one .txt per image, same basename
```

Each label file is YOLO format — one line per leaf, normalized 0–1:

```
0 <center_x> <center_y> <width> <height>
```

(class index is always `0` since there's only one class). Re-run
`tools/build_leaf_detection_dataset.py` to rebuild from scratch (it also
rewrites `configs/yolo_leaf_detection.yaml`, which `training/train_yolov8_leaf_detector.py`
reads but never regenerates itself).
