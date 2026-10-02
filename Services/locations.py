import json
import os
from typing import Optional

# Philippine Standard Geographic Code (PSA): region > province > city/municipality > barangay.
_PATH = os.path.join(os.path.dirname(__file__), "psgc.json")

with open(_PATH, encoding="utf-8") as _f:
    _DATA = json.load(_f)

REGIONS = {code: name for code, name in _DATA["regions"]}
PROVINCES = {code: {"name": name, "region": region} for code, name, region in _DATA["provinces"]}
CITIES = {code: {"name": name, "region": region, "province": province}
          for code, name, region, province in _DATA["cities"]}
BARANGAYS = {code: {"name": name, "city": city}
             for city, rows in _DATA["barangays"].items() for code, name in rows}

def regions() -> list[dict]:
    return [{"code": code, "name": name} for code, name in _DATA["regions"]]

def provinces(region: str) -> dict:
    items = [{"code": code, "name": name} for code, name, reg in _DATA["provinces"] if reg == region]
    independent = any(c["region"] == region and c["province"] is None for c in CITIES.values())
    return {"provinces": items, "independent_cities": independent}

def cities(region: str, province: Optional[str]) -> list[dict]:
    return [{"code": code, "name": name} for code, name, reg, prov in _DATA["cities"]
            if reg == region and prov == province]

def barangays(city: str) -> list[dict]:
    return [{"code": code, "name": name} for code, name in _DATA["barangays"].get(city, [])]

def is_valid(region: Optional[str], province: Optional[str], city: Optional[str], barangay: Optional[str]) -> bool:
    if region not in REGIONS or city not in CITIES or barangay not in BARANGAYS:
        return False
    if province is not None and PROVINCES.get(province, {}).get("region") != region:
        return False
    c = CITIES[city]
    return c["region"] == region and c["province"] == province and BARANGAYS[barangay]["city"] == city

def describe(region, province, city, barangay) -> dict:
    return {
        "region": REGIONS.get(region),
        "province": PROVINCES.get(province, {}).get("name"),
        "city": CITIES.get(city, {}).get("name"),
        "barangay": BARANGAYS.get(barangay, {}).get("name"),
    }
