"""CADRI (Context-Aware Disease Risk Index) and EIL (Economic Injury Level)
decision engine.

Sits after the YOLOv8 -> EfficientNetV2 -> Grad-CAM pipeline
(src/cropguardian/inference/pipeline.py) and turns its per-leaf outputs,
plus live sensor readings, into a spray / monitor / manual-inspection
decision.

    Er(d)  = sum_k w_k * exp(-(x_k - mu_k_d)^2 / (2 * sigma_k_d^2))
             -- how closely current sensor readings match pathogen d's
             optimal conditions, per sensor k in {temp, humidity, soil, air}.

    CADRI  = Cd * [alpha * Sv + (1 - alpha) * Er(d)]
             -- classifier confidence scaling a severity/environment blend.

    EIL    = C_treatment / (V_per_plant * D * K)
             -- the infection level at which treatment cost equals the
             yield loss it prevents; standard IPM economic-injury-level form.

All disease-specific numbers (mu/sigma/weights/D/K) live in
configs/pathogen_params.json, keyed by the exact class names EfficientNetV2
emits (src/cropguardian/inference/predictor.py:CLASS_NAMES) so this module
can be fed the real pipeline output with no translation step.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
PATHOGEN_PARAMS_PATH = PROJECT_ROOT / "configs" / "pathogen_params.json"

DEFAULT_ALPHA = 0.5
DEFAULT_TREATMENT_COST_PER_PLANT = 5.0  # Rs
DEFAULT_MSP_PER_QUINTAL = 8500.0  # Rs per quintal (100kg), tomato MSP-equivalent
AVERAGE_YIELD_KG_PER_PLANT = 2.0

CONFIDENCE_GAP_THRESHOLD = 0.25
LOW_CONFIDENCE_THRESHOLD = 0.60

# CADRI/EIL ratio cutoffs for spray intensity. Not specified beyond "based on
# how far CADRI exceeds EIL" -- a reasonable, tunable default banding.
FULL_SPRAY_RATIO = 2.5
MODERATE_SPRAY_RATIO = 1.5

# Display name / scientific name / treatment text for the human-readable
# "reasoning" string -- kept separate from pathogen_params.json since that
# file's schema is numeric-only per the design spec.
DISEASE_METADATA = {
    "Tomato_Bacterial_spot": {
        "display_name": "Bacterial Spot",
        "scientific_name": "Xanthomonas spp.",
        "treatment": "Apply a copper-based bactericide. Avoid overhead irrigation and working with wet foliage.",
    },
    "Tomato_Early_blight": {
        "display_name": "Early Blight",
        "scientific_name": "Alternaria solani",
        "treatment": "Apply Mancozeb 2.5g/L on leaf undersides. Avoid overhead irrigation.",
    },
    "Tomato_Late_blight": {
        "display_name": "Late Blight",
        "scientific_name": "Phytophthora infestans",
        "treatment": "Apply a systemic fungicide (e.g. metalaxyl + mancozeb) immediately and remove infected foliage.",
    },
    "Tomato_Leaf_Mold": {
        "display_name": "Leaf Mold",
        "scientific_name": "Passalora fulva",
        "treatment": "Increase ventilation, keep humidity below 85%, and apply a preventive fungicide.",
    },
    "Tomato_Septoria_leaf_spot": {
        "display_name": "Septoria Leaf Spot",
        "scientific_name": "Septoria lycopersici",
        "treatment": "Prune lower foliage, apply a chlorothalonil or copper fungicide, and switch to drip irrigation.",
    },
    "Tomato_Spider_mites_Two_spotted_spider_mite": {
        "display_name": "Spider Mites",
        "scientific_name": "Tetranychus urticae",
        "treatment": "Apply a miticide (e.g. abamectin) or insecticidal soap; raising humidity slows their spread.",
    },
    "Tomato__Target_Spot": {
        "display_name": "Target Spot",
        "scientific_name": "Corynespora cassiicola",
        "treatment": "Apply a strobilurin or chlorothalonil fungicide and improve canopy airflow.",
    },
    "Tomato__Tomato_YellowLeaf__Curl_Virus": {
        "display_name": "Yellow Leaf Curl Virus",
        "scientific_name": "Tomato yellow leaf curl virus (TYLCV)",
        "treatment": "No chemical cure. Remove and destroy infected plants; control the whitefly vector.",
    },
    "Tomato__Tomato_mosaic_virus": {
        "display_name": "Mosaic Virus",
        "scientific_name": "Tomato mosaic virus (ToMV)",
        "treatment": "No chemical cure. Remove infected plants and disinfect tools/hands between plants.",
    },
    "Tomato_healthy": {
        "display_name": "Healthy",
        "scientific_name": None,
        "treatment": "No treatment needed.",
    },
}


def _load_pathogen_params(path: Path = PATHOGEN_PARAMS_PATH) -> dict:
    diseases = json.loads(path.read_text())["diseases"]
    for disease, p in diseases.items():
        weight_sum = p["w_temp"] + p["w_humidity"] + p["w_soil"] + p["w_air"]
        if abs(weight_sum - 1.0) > 1e-6:
            raise ValueError(f"{disease}: sensor weights sum to {weight_sum}, expected 1.0")
    if diseases.keys() != DISEASE_METADATA.keys():
        raise ValueError("pathogen_params.json diseases don't match DISEASE_METADATA keys")
    return diseases


PATHOGEN_PARAMS = _load_pathogen_params()


def _gaussian_match(x: float, mu: float, sigma: float) -> float:
    return math.exp(-((x - mu) ** 2) / (2 * sigma**2))


def environmental_risk_score(
    disease_class: str, temperature: float, humidity: float, soil_moisture: float, air_quality: float
) -> float:
    """Er(d): weighted sum of how closely each sensor reading matches
    pathogen d's optimal condition for that sensor."""
    p = PATHOGEN_PARAMS[disease_class]
    return (
        p["w_temp"] * _gaussian_match(temperature, p["mu_temp"], p["sigma_temp"])
        + p["w_humidity"] * _gaussian_match(humidity, p["mu_humidity"], p["sigma_humidity"])
        + p["w_soil"] * _gaussian_match(soil_moisture, p["mu_soil"], p["sigma_soil"])
        + p["w_air"] * _gaussian_match(air_quality, p["mu_air"], p["sigma_air"])
    )


def compute_cadri(confidence: float, Sv: float, Er: float, alpha: float = DEFAULT_ALPHA) -> float:
    return confidence * (alpha * Sv + (1 - alpha) * Er)


def compute_eil(
    disease_class: str,
    treatment_cost: float = DEFAULT_TREATMENT_COST_PER_PLANT,
    msp_per_quintal: float = DEFAULT_MSP_PER_QUINTAL,
    yield_kg_per_plant: float = AVERAGE_YIELD_KG_PER_PLANT,
) -> float:
    p = PATHOGEN_PARAMS[disease_class]
    value_per_plant = (msp_per_quintal / 100.0) * yield_kg_per_plant  # Rs/quintal -> Rs/kg -> Rs/plant
    damage_efficacy = p["D"] * p["K"]
    if damage_efficacy <= 0:
        # No yield-damaging pathogen (Healthy: D=K=0) or a misconfigured
        # entry -- there is no infection level at which treatment spend is
        # repaid, so no finite threshold exists. CADRI (bounded <= confidence
        # <= 1) can never exceed +inf, so the decision below naturally comes
        # out "no_spray" without a hardcoded disease-name special case.
        return math.inf
    return treatment_cost / (value_per_plant * damage_efficacy)


def _spray_intensity(cadri: float, eil: float) -> str:
    ratio = cadri / eil
    if ratio >= FULL_SPRAY_RATIO:
        return "full_spray"
    if ratio >= MODERATE_SPRAY_RATIO:
        return "moderate_spray"
    return "light_spray"


def compute_decision(
    disease_class: str,
    confidence: float,
    top2_confidence: float,
    Sv: float,
    temperature: float | None = None,
    humidity: float | None = None,
    soil_moisture: float | None = None,
    air_quality: float | None = None,
    alpha: float = DEFAULT_ALPHA,
    treatment_cost: float = DEFAULT_TREATMENT_COST_PER_PLANT,
    msp_per_quintal: float = DEFAULT_MSP_PER_QUINTAL,
) -> dict:
    """Runs the confidence-gap check, then Er/CADRI/EIL, and returns the
    structured decision dict described in the module's design doc.

    Sensor readings are optional -- when the Arduino isn't connected, the
    caller passes all four as None rather than faking values, and this
    falls back to a vision-only CADRI (confidence * Sv) with no spray
    decision, since EIL is meaningless without an environmental risk term
    to compare it against.
    """
    if disease_class not in PATHOGEN_PARAMS:
        raise ValueError(f"Unknown disease_class {disease_class!r}; expected one of {sorted(PATHOGEN_PARAMS)}")

    meta = DISEASE_METADATA[disease_class]
    display_name = meta["display_name"]

    gap = confidence - top2_confidence
    flagged = gap < CONFIDENCE_GAP_THRESHOLD and confidence < LOW_CONFIDENCE_THRESHOLD

    sensors_available = not all(v is None for v in (temperature, humidity, soil_moisture, air_quality))

    if not sensors_available:
        cadri = confidence * Sv
        reasoning = (
            f"{display_name} detected with {Sv:.0%} leaf area affected ({confidence:.0%} confidence). "
            "Sensor data unavailable — connect Arduino for environmental risk assessment and spray decision."
        )
        return {
            "disease": display_name,
            "confidence": round(confidence, 4),
            "severity_score": round(Sv, 4),
            "environmental_risk": None,
            "cadri": round(cadri, 4),
            "eil": None,
            "decision": "sensors_unavailable",
            "reasoning": reasoning,
            "sensors_available": False,
            "flagged_for_inspection": flagged,
        }

    Er = environmental_risk_score(disease_class, temperature, humidity, soil_moisture, air_quality)
    cadri = compute_cadri(confidence, Sv, Er, alpha)
    eil = compute_eil(disease_class, treatment_cost, msp_per_quintal)

    if flagged:
        decision = "manual_inspection"
        reasoning = (
            f"Prediction ambiguous: top class '{display_name}' at {confidence:.0%} confidence is only "
            f"{gap:.0%} ahead of the second-most-likely class ({top2_confidence:.0%}). "
            "Flagging for manual inspection instead of an automated spray decision."
        )
    elif not math.isfinite(eil):
        decision = "no_spray"
        reasoning = (
            f"{display_name}: no yield-damaging pathogen detected, so no treatment threshold applies. "
            "Continue routine monitoring."
        )
    elif cadri > eil:
        decision = _spray_intensity(cadri, eil)
        intensity_phrase = {
            "light_spray": "Light spray",
            "moderate_spray": "Moderate spray",
            "full_spray": "Full spray",
        }[decision]
        reasoning = (
            f"{display_name} detected with {Sv:.0%} leaf area affected. "
            f"Temperature {temperature:.0f}°C and humidity {humidity:.0f}% "
            f"{'closely match' if Er >= 0.6 else 'partially match'} optimal conditions for {meta['scientific_name']}. "
            f"CADRI ({cadri:.1%}) exceeds EIL ({eil:.1%}). {intensity_phrase} recommended. {meta['treatment']}"
        )
    else:
        decision = "no_spray"
        reasoning = (
            f"{display_name} detected with {Sv:.0%} leaf area affected, but CADRI ({cadri:.1%}) does not exceed "
            f"EIL ({eil:.1%}) -- treatment cost would exceed the prevented yield loss. Continue monitoring."
        )

    return {
        "disease": display_name,
        "confidence": round(confidence, 4),
        "severity_score": round(Sv, 4),
        "environmental_risk": round(Er, 4),
        "cadri": round(cadri, 4),
        "eil": round(eil, 4) if math.isfinite(eil) else None,
        "decision": decision,
        "reasoning": reasoning,
        "sensors_available": True,
        "flagged_for_inspection": flagged,
    }
