"""Compute per-ward land-cover percentages for Mysuru, per year, from GEE
Dynamic World — synchronously via getInfo() since 65 wards x 9 classes x 8
years is tiny. Outputs CSV files compatible with the existing Pune
import-land-cover.cjs schema:

  mysuru_ward_landcover_<year>.csv: ward_number, year, total_area_m2,
    trees_area_m2, built_area_m2, grass_area_m2, bare_area_m2,
    water_area_m2, crops_area_m2 (+ _pct each)

  mysuru_ward_change_<from>_<to>.csv: ward_number, from_year, to_year,
    period, trees_lost_m2, trees_gained_m2, net_tree_change_m2,
    built_gained_m2, trees_to_built_m2

Then a companion script (import-mysuru-land-cover.cjs) loads these into
the DO Postgres tables mysuru_land_cover_stats + mysuru_land_cover_change.

RUN: python scripts/gee_mysuru_zonal_stats.py

Auth: service account (same as gee_mysuru_export.py); GCS not needed
since getInfo() returns the data inline. The compute happens on GEE
servers — script just orchestrates and writes CSVs locally.
"""

from __future__ import annotations

import json
import os
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import ee

ROOT = Path(__file__).resolve().parent.parent
KEY_PATH = r"E:\Rainmatter\FNE\JP_Nagar_GIS\Earth Engine\ee-your-kaushik-567bdad16705.json"
KML_PATH = ROOT / "data" / "raw" / "Mysuru_Ward_Map.kml"
OUT_DIR = ROOT / "data" / "processed-rasters" / "mysuru" / "zonal_stats"
OUT_DIR.mkdir(parents=True, exist_ok=True)

YEARS = list(range(2019, 2027))  # 2019..2026
CHANGE_PERIODS = [(2019, 2022), (2019, 2025), (2019, 2026), (2022, 2025), (2025, 2026)]

# Dynamic World class indices (0-8). Map to friendly column names.
DW_CLASS_NAMES = {
    0: "water",
    1: "trees",
    2: "grass",
    3: "flooded",  # flooded vegetation
    4: "crops",
    5: "shrub",
    6: "built",
    7: "bare",
    8: "snow",
}
# Columns the Pune schema expects + _pct variants. We map DW's 9 classes onto
# these 6 categories (collapsing flooded into water, shrub into bare to match
# Pune's grouping). Pune's import-land-cover.cjs reads exactly these columns.
PUNE_COLS = ["trees", "built", "grass", "bare", "water", "crops"]
DW_TO_PUNE = {
    "trees": ["trees"],
    "built": ["built"],
    "grass": ["grass"],
    "bare": ["bare", "shrub"],          # shrub collapses to bare (Pune doesn't track shrub)
    "water": ["water", "flooded"],      # flooded vegetation collapses to water
    "crops": ["crops"],
}


def init_ee():
    with open(KEY_PATH) as f:
        proj = json.load(f)["project_id"]
    try:
        ee.Initialize(project=proj)
    except Exception:
        with open(KEY_PATH) as f:
            email = json.load(f)["client_email"]
        creds = ee.ServiceAccountCredentials(email, key_file=KEY_PATH)
        ee.Initialize(creds, project=proj)


def load_wards_from_kml() -> ee.FeatureCollection:
    """Parse the Mysuru KML into an ee.FeatureCollection of 65 wards."""
    ns = "{http://www.opengis.net/kml/2.2}"
    tree = ET.parse(KML_PATH)
    root = tree.getroot()
    features = []
    for placemark in root.iter(f"{ns}Placemark"):
        props = {}
        for sd in placemark.iter(f"{ns}SimpleData"):
            props[sd.attrib.get("name")] = sd.text
        coords_el = placemark.find(f".//{ns}coordinates")
        if coords_el is None or not coords_el.text:
            continue
        ring = []
        for triple in coords_el.text.strip().split():
            parts = triple.split(",")
            ring.append([float(parts[0]), float(parts[1])])
        if len(ring) < 4:
            continue
        feat = ee.Feature(
            ee.Geometry.Polygon([ring]),
            {
                "ward_no": int(props.get("KGISWardNo", "0")),
                "ward_name": props.get("KGISWardName", ""),
            },
        )
        features.append(feat)
    print(f"  parsed {len(features)} wards from KML")
    return ee.FeatureCollection(features)


def dw_annual_mode(year: int) -> ee.Image:
    """Dynamic World annual modal landcover class, scaled so areaImage gives m^2."""
    return (
        ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1")
        .filterDate(f"{year}-01-01", f"{year}-12-31")
        .select("label")
        .mode()
        .rename("landcover")
    )


def zonal_class_areas(year: int, wards: ee.FeatureCollection) -> dict:
    """For each ward, compute total area per Dynamic World class (m^2).

    Returns: { ward_no: { dw_class_name: area_m2, ..., total_area_m2 } }
    """
    dw = dw_annual_mode(year)
    # Multiply each class by ee.Image.pixelArea() so each pixel contributes
    # its actual area (in m^2). Group by landcover class via reduceRegions.
    area_image = ee.Image.pixelArea().addBands(dw)
    # groupedReducer: sum(area) grouped by landcover class id
    grouped = area_image.reduceRegions(
        collection=wards,
        reducer=ee.Reducer.sum().group(groupField=1, groupName="class"),
        scale=10,
    )

    # Pull all rows down synchronously. .getInfo() materializes the FeatureCollection.
    fc_dict = grouped.getInfo()
    out = {}
    for feat in fc_dict.get("features", []):
        props = feat["properties"]
        ward_no = props.get("ward_no")
        groups = props.get("groups", [])
        class_areas = {DW_CLASS_NAMES.get(g["class"], f"class_{g['class']}"): float(g["sum"]) for g in groups}
        total = sum(class_areas.values())
        out[ward_no] = {"_total_m2": total, **class_areas}
    return out


def collapse_to_pune_cols(class_areas: dict) -> dict:
    """Map DW's 9-class areas onto Pune's 6 columns."""
    pune_areas = {}
    for pune_col, dw_classes in DW_TO_PUNE.items():
        pune_areas[pune_col] = sum(class_areas.get(c, 0.0) for c in dw_classes)
    return pune_areas


def write_yearly_csv(year: int, ward_stats: dict):
    out_path = OUT_DIR / f"mysuru_ward_landcover_{year}.csv"
    cols = ["ward_number", "year", "total_area_m2"]
    cols += [f"{c}_area_m2" for c in PUNE_COLS]
    cols += [f"{c}_pct" for c in PUNE_COLS]

    with open(out_path, "w", newline="", encoding="utf-8") as f:
        f.write(",".join(cols) + "\n")
        for ward_no in sorted(ward_stats.keys()):
            s = ward_stats[ward_no]
            total = s.get("_total_m2", 0.0)
            pune = collapse_to_pune_cols(s)
            row = [str(ward_no), str(year), f"{total:.2f}"]
            row += [f"{pune[c]:.2f}" for c in PUNE_COLS]
            row += [f"{(pune[c]/total*100 if total else 0):.4f}" for c in PUNE_COLS]
            f.write(",".join(row) + "\n")
    print(f"  wrote {out_path.name}")


def write_change_csv(from_year: int, to_year: int, from_stats: dict, to_stats: dict):
    out_path = OUT_DIR / f"mysuru_ward_change_{from_year}_{to_year}.csv"
    cols = ["ward_number", "from_year", "to_year", "period",
            "trees_lost_m2", "trees_gained_m2", "net_tree_change_m2",
            "built_gained_m2", "trees_to_built_m2"]
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        f.write(",".join(cols) + "\n")
        common_wards = sorted(set(from_stats.keys()) & set(to_stats.keys()))
        for ward in common_wards:
            f_p = collapse_to_pune_cols(from_stats[ward])
            t_p = collapse_to_pune_cols(to_stats[ward])
            trees_diff = t_p["trees"] - f_p["trees"]
            built_diff = t_p["built"] - f_p["built"]
            row = [
                str(ward), str(from_year), str(to_year), f"{from_year}_to_{to_year}",
                f"{max(0, -trees_diff):.2f}",   # trees_lost (positive number)
                f"{max(0, trees_diff):.2f}",    # trees_gained
                f"{trees_diff:.2f}",            # net change (can be negative)
                f"{max(0, built_diff):.2f}",    # built area gained
                f"{max(0, min(-trees_diff, built_diff)):.2f}",  # estimated trees converted to built
            ]
            f.write(",".join(row) + "\n")
    print(f"  wrote {out_path.name}")


def main():
    print("init Earth Engine...")
    init_ee()

    print("load Mysuru wards...")
    wards = load_wards_from_kml()

    print(f"\n== Zonal stats over {len(YEARS)} years ==")
    yearly = {}
    for year in YEARS:
        print(f"  year {year}: querying GEE...")
        try:
            ward_stats = zonal_class_areas(year, wards)
            yearly[year] = ward_stats
            write_yearly_csv(year, ward_stats)
        except Exception as e:
            print(f"  year {year}: FAILED ({type(e).__name__}: {e})")

    print(f"\n== Year-pair change tables ==")
    for (a, b) in CHANGE_PERIODS:
        if a in yearly and b in yearly:
            write_change_csv(a, b, yearly[a], yearly[b])

    print(f"\nDone. CSVs at: {OUT_DIR}")


if __name__ == "__main__":
    main()
