from typing import Optional

from fastapi import APIRouter, Query

from Services import locations

router = APIRouter()

# Public: the registration form needs these before anyone is signed in.
# Each list depends on the one above it, so the form loads them one level at a time.


@router.get("/locations/regions")
def list_regions():
    return locations.regions()


@router.get("/locations/provinces")
def list_provinces(region: str = Query(..., max_length=10)):
    return locations.provinces(region)


# Leave out `province` for cities that belong to no province (Metro Manila, a few independent cities).
@router.get("/locations/cities")
def list_cities(region: str = Query(..., max_length=10), province: Optional[str] = Query(None, max_length=10)):
    return locations.cities(region, province)


@router.get("/locations/barangays")
def list_barangays(city: str = Query(..., max_length=10)):
    return locations.barangays(city)
