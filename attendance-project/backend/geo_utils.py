"""
GPS Geofencing Utility Module
Smart Attendance System

Provides distance calculation and geofence verification using the Haversine formula.
Validates that students are physically inside the designated classroom or campus zone
before granting attendance.
"""

import math
from typing import List, Dict, Optional, Tuple


def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Computes the great-circle distance between two GPS coordinates in meters.

    Formula:
        a = sin²(Δφ/2) + cos(φ1) ⋅ cos(φ2) ⋅ sin²(Δλ/2)
        c = 2 ⋅ atan2( √a, √(1−a) )
        d = R ⋅ c
    where R = 6,371,000 meters (mean Earth radius).
    """
    earth_radius_meters = 6371000.0

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2) + (
        math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2)
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    distance = earth_radius_meters * c
    return round(distance, 2)


def is_within_radius(
    user_lat: float, user_lon: float,
    zone_lat: float, zone_lon: float,
    radius_meters: float
) -> Tuple[bool, float]:
    """
    Checks if a user's coordinates fall within a specific zone's radius.

    Returns:
        (is_within: bool, distance_in_meters: float)
    """
    dist = haversine_distance_meters(user_lat, user_lon, zone_lat, zone_lon)
    return (dist <= radius_meters), dist


def find_nearest_zone(
    user_lat: float, user_lon: float, zones: List[Dict], drift_tolerance_meters: float = 120.0
) -> Tuple[Optional[Dict], float, bool]:
    """
    Finds the nearest active geofence zone to the user's position and checks if
    the user is inside it, accounting for standard indoor GPS multi-path drift.

    Args:
        user_lat: Student's reported latitude
        user_lon: Student's reported longitude
        zones: List of zone dictionaries with keys ['id', 'name', 'latitude', 'longitude', 'radius_meters', 'is_active']
        drift_tolerance_meters: GPS buffer (default 120m) to accommodate indoor attenuation

    Returns:
        (nearest_zone: Optional[Dict], distance_meters: float, is_inside: bool)
    """
    active_zones = [z for z in zones if z.get("is_active", 1)]
    if not active_zones:
        # If no active boundaries are defined, default to verified to avoid blocking students
        return None, 0.0, True

    closest_zone = None
    min_distance = float("inf")
    inside = False

    for zone in active_zones:
        dist = haversine_distance_meters(
            user_lat, user_lon, zone["latitude"], zone["longitude"]
        )
        if dist < min_distance:
            min_distance = dist
            closest_zone = zone

    if closest_zone:
        effective_radius = float(closest_zone.get("radius_meters", 50.0)) + float(drift_tolerance_meters)
        if min_distance <= effective_radius:
            inside = True

    return closest_zone, min_distance, inside
