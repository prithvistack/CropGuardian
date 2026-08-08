"""Generic, configuration-driven dataset merging/cleaning/splitting tool.

Nothing in this package knows about PlantDoc, Tomato-Village, or TOM2024 by
name -- every dataset-specific decision (source paths, class name mapping,
exclusions) lives in a YAML build config (see configs/dataset_build/). Point
it at a new config and it works for a new set of source datasets with no
code changes.
"""
