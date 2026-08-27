
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple
import re

DEFAULT_PRIORITIES: Dict[str, float] = {
    "budget":       0.35,
    "location":     0.25,
    "rating":       0.25,
    "availability": 0.15,
}


def _safe_float(value: Any, fallback: float = 0.0) -> float:
    """Convert any value to float without raising."""
    if value is None:
        return fallback
    if isinstance(value, (int, float)):
        return float(value)
    try:
        cleaned = str(value).replace(",", "").strip()
        return float(cleaned)
    except (TypeError, ValueError):
        return fallback


class VendorMatchService:

    def score_vendors(
        self,
        vendors: List[Dict[str, Any]],
        user_info: Dict[str, Any],
        priorities: Optional[Dict[str, float]] = None,
    ) -> List[Dict[str, Any]]:
        
        raw_weights = self._clean_priorities(priorities or {})

        scored: List[Dict[str, Any]] = []
        for vendor in vendors:
            try:
                score, reason, report, recommended_pkg = self._score_one(
                    vendor, user_info, raw_weights
                )
            except Exception as exc:
                print(f"[MATCH] Scoring error for {vendor.get('business_name')}: {exc}")
                score, reason, report, recommended_pkg = (
                    50,
                    "Match score unavailable.",
                    {},
                    None,
                )

            v = dict(vendor)
            v["match_score"] = score
            v["match_reason"] = reason
            v["match_report"] = report
            if recommended_pkg:
                v["_recommended_package"] = recommended_pkg
            scored.append(v)

        scored.sort(key=lambda item: item.get("match_score") or 0, reverse=True)
        return scored

    def _clean_priorities(self, raw: Dict[str, float]) -> Dict[str, float]:
        """Ensure raw weights are valid floats, defaulting to DEFAULT_PRIORITIES."""
        cleaned: Dict[str, float] = {}
        for key, default_val in DEFAULT_PRIORITIES.items():
            val = raw.get(key, default_val)
            cleaned[key] = max(0.0, min(1.0, _safe_float(val, default_val)))
        return cleaned

    def _score_one(
        self,
        vendor: Dict[str, Any],
        user_info: Dict[str, Any],
        raw_weights: Dict[str, float],
    ) -> Tuple[int, str, Dict[str, Any], Optional[Dict[str, Any]]]:
    
        # 1. Evaluate each dimension independently
        budget_eval = self._score_budget(vendor, user_info)
        location_eval = self._score_location(vendor, user_info)
        rating_eval = self._score_rating(vendor, user_info)
        avail_eval = self._score_availability(vendor, user_info)

        evals: Dict[str, Dict[str, Any]] = {
            "budget": budget_eval,
            "location": location_eval,
            "rating": rating_eval,
            "availability": avail_eval,
        }

        active_keys = [
            k for k, v in evals.items()
            if v.get("score") is not None and v.get("status") not in ("not_specified", "not_verified")
        ]

        active_weight_sum = sum(raw_weights.get(k, DEFAULT_PRIORITIES[k]) for k in active_keys)

        norm_weights: Dict[str, float] = {}
        if active_weight_sum > 0:
            for k in evals:
                if k in active_keys:
                    norm_weights[k] = raw_weights.get(k, DEFAULT_PRIORITIES[k]) / active_weight_sum
                else:
                    norm_weights[k] = 0.0
        else:
            # No specific requirements given (e.g. user said "any" for everything)
            for k in evals:
                norm_weights[k] = 0.0

        # 4. Calculate weighted composite score
        if active_keys:
            raw_score = sum(
                evals[k]["score"] * norm_weights[k]
                for k in active_keys
            )
            final_score = int(round(min(100.0, max(0.0, raw_score * 100))))
        else:
            final_score = 100

        match_report: Dict[str, Any] = {}
        for k, eval_dict in evals.items():
            comp_score = eval_dict.get("score")
            match_report[k] = {
                "score": int(round(comp_score * 100)) if comp_score is not None else None,
                "weight": round(norm_weights.get(k, 0.0), 2),
                "status": eval_dict.get("status"),
                "reason": eval_dict.get("reason"),
            }

        match_reason = self._build_requirement_reason(evals, active_keys, final_score)

        recommended_package = budget_eval.get("recommended_package")
        return final_score, match_reason, match_report, recommended_package
    def _score_budget(
        self,
        vendor: Dict[str, Any],
        user_info: Dict[str, Any],
    ) -> Dict[str, Any]:

        user_budget_raw = user_info.get("budget")
        if user_budget_raw in (None, "", "any", "Flexible"):
            return {
                "score": None,
                "status": "not_specified",
                "reason": "No budget requirement specified.",
                "recommended_package": (vendor.get("packages") or [None])[0],
            }

        user_budget = _safe_float(user_budget_raw, 0.0)
        if user_budget <= 0:
            return {
                "score": None,
                "status": "not_specified",
                "reason": "No budget requirement specified.",
                "recommended_package": (vendor.get("packages") or [None])[0],
            }

        packages: List[Dict[str, Any]] = vendor.get("packages") or []
        valid_packages = [
            p for p in packages
            if _safe_float(p.get("price"), -1) > 0
        ]

        if not valid_packages:
            return {
                "score": 0.80,
                "status": "unspecified_pricing",
                "reason": "Vendor has not listed package prices; pricing to be confirmed.",
                "recommended_package": None,
            }

        affordable = [
            p for p in valid_packages
            if _safe_float(p.get("price"), 0) <= user_budget
        ]

        if affordable:
            # Best affordable is highest-tier package that still fits in budget
            best_pkg = max(affordable, key=lambda p: _safe_float(p.get("price"), 0))
            best_price = _safe_float(best_pkg.get("price"), 0)
            best_name = best_pkg.get("name", "Standard")
            return {
                "score": 1.0,
                "status": "met",
                "reason": f"Package '{best_name}' is PKR {int(best_price):,}, within your PKR {int(user_budget):,} budget.",
                "recommended_package": best_pkg,
            }
        else:
            # All packages exceed user budget
            min_pkg = min(valid_packages, key=lambda p: _safe_float(p.get("price"), 0))
            min_price = _safe_float(min_pkg.get("price"), 0)
            min_name = min_pkg.get("name", "Standard")
            overshoot = (min_price - user_budget) / user_budget

            if overshoot <= 0.10:
                score = 0.90
                status = "slightly_above"
            elif overshoot <= 0.25:
                score = 0.75
                status = "moderately_above"
            elif overshoot <= 0.50:
                score = 0.50
                status = "significantly_above"
            else:
                score = max(0.0, round(1.0 - overshoot, 2))
                status = "above_budget"

            return {
                "score": score,
                "status": status,
                "reason": f"Lowest package '{min_name}' is PKR {int(min_price):,}, exceeding your PKR {int(user_budget):,} budget.",
                "recommended_package": min_pkg,
            }

    def _score_location(
        self,
        vendor: Dict[str, Any],
        user_info: Dict[str, Any],
    ) -> Dict[str, Any]:
        
        address: str = (vendor.get("business_address") or "").strip()
        address_lower = address.lower()

        raw_cities = user_info.get("city")
        if isinstance(raw_cities, str):
            cities = [c.strip().lower() for c in raw_cities.split(",") if c.strip()]
        elif isinstance(raw_cities, list):
            cities = [str(c).strip().lower() for c in raw_cities if str(c).strip()]
        else:
            cities = []

        cities = [c for c in cities if c not in ("any", "all", "none", "")]

        pref_area = str(user_info.get("location") or "").strip().lower()
        if pref_area in ("any", "all", "none", ""):
            pref_area = ""

        city_specified = bool(cities)
        area_specified = bool(pref_area)

        if not city_specified and not area_specified:
            return {
                "score": None,
                "status": "not_specified",
                "reason": "No city or area preference specified.",
            }

        city_matched = False
        matched_city_name = ""
        if city_specified:
            for c in cities:
                if re.search(rf"\b{re.escape(c)}\b", address_lower):
                    city_matched = True
                    matched_city_name = c.title()
                    break
        else:
            city_matched = True

        area_matched = False
        if area_specified:
            area_matched = bool(re.search(rf"\b{re.escape(pref_area)}\b", address_lower))

        if city_specified and area_specified:
            if city_matched and area_matched:
                return {
                    "score": 1.0,
                    "status": "met",
                    "reason": f"Vendor is located in {pref_area.title()}, {matched_city_name}.",
                }
            elif city_matched:
                return {
                    "score": 0.75,
                    "status": "city_matched_area_unmatched",
                    "reason": f"Vendor is in {matched_city_name}, but not specifically in {pref_area.title()}.",
                }
            else:
                target_str = ", ".join(c.title() for c in cities)
                return {
                    "score": 0.0,
                    "status": "unmatched",
                    "reason": f"Vendor is outside your requested city ({target_str}).",
                }

        elif city_specified and not area_specified:
            if city_matched:
                return {
                    "score": 1.0,
                    "status": "met",
                    "reason": f"Vendor is located in {matched_city_name}.",
                }
            else:
                target_str = ", ".join(c.title() for c in cities)
                return {
                    "score": 0.0,
                    "status": "unmatched",
                    "reason": f"Vendor is outside your requested city ({target_str}).",
                }

        else:  # area_specified without city
            if area_matched:
                return {
                    "score": 1.0,
                    "status": "met",
                    "reason": f"Vendor is located in {pref_area.title()}.",
                }
            else:
                return {
                    "score": 0.50,
                    "status": "unmatched",
                    "reason": f"Vendor address does not match requested area {pref_area.title()}.",
                }

    def _score_rating(
        self,
        vendor: Dict[str, Any],
        user_info: Dict[str, Any],
    ) -> Dict[str, Any]:
        
        vendor_rating = _safe_float(vendor.get("rating"), 0.0)
        min_rating_raw = user_info.get("min_rating")

        min_rating: Optional[float] = None
        if min_rating_raw is not None and str(min_rating_raw).lower() not in ("any", "none", "", "all"):
            cleaned_min = str(min_rating_raw).replace("+", "").strip()
            parsed_val = _safe_float(cleaned_min, -1.0)
            if parsed_val > 0:
                min_rating = parsed_val

        if min_rating is None:
            return {
                "score": None,
                "status": "not_specified",
                "reason": "No minimum rating preference specified.",
            }

        req_str = f"{int(min_rating) if min_rating == int(min_rating) else min_rating}+"

        if vendor_rating >= min_rating:
            return {
                "score": 1.0,
                "status": "met",
                "reason": f"Vendor rating is {vendor_rating:.1f}/5, meeting your minimum requirement of {req_str}.",
            }
        elif vendor_rating == 0:
            return {
                "score": 0.50,
                "status": "unrated",
                "reason": f"Vendor is not yet rated (minimum requested was {req_str}).",
            }
        else:
            proportional = max(0.0, min(1.0, round(vendor_rating / min_rating, 2)))
            return {
                "score": proportional,
                "status": "below_minimum",
                "reason": f"Vendor rating is {vendor_rating:.1f}/5, which is below your {req_str} preference.",
            }

    def _score_availability(
        self,
        vendor: Dict[str, Any],
        user_info: Dict[str, Any],
    ) -> Dict[str, Any]:
    
        date = user_info.get("date")
        if not date or str(date).lower() in ("flexible", "any", "all", "none", ""):
            return {
                "score": None,
                "status": "not_specified",
                "reason": "No specific date requested.",
            }

        is_verified = vendor.get("_availability_verified")
        is_available = vendor.get("_is_available")

        if is_verified is True:
            if is_available is True:
                return {
                    "score": 1.0,
                    "status": "verified_available",
                    "reason": f"Verified available on your event date ({date}).",
                }
            else:
                return {
                    "score": 0.0,
                    "status": "unavailable",
                    "reason": f"Already booked on your event date ({date}).",
                }
        else:
            return {
                "score": None,
                "status": "not_verified",
                "reason": f"Availability for {date} could not be verified in advance.",
            }

    def _build_requirement_reason(
        self,
        evals: Dict[str, Dict[str, Any]],
        active_keys: List[str],
        score: int,
    ) -> str:
        
        dimension_labels = {
            "budget": "budget",
            "location": "location",
            "rating": "minimum rating",
            "availability": "date availability",
        }

        met_dims = [
            dimension_labels[k] for k in active_keys
            if evals[k].get("score") == 1.0
        ]

        unmet_reasons = []
        for k in active_keys:
            eval_dict = evals[k]
            if eval_dict.get("score") is not None and eval_dict.get("score") < 1.0:
                if k == "budget":
                    unmet_reasons.append("lowest package exceeds your budget")
                elif k == "location":
                    if eval_dict.get("status") == "city_matched_area_unmatched":
                        unmet_reasons.append("outside your preferred sub-area")
                    else:
                        unmet_reasons.append("outside your requested city")
                elif k == "rating":
                    unmet_reasons.append("rating is below your preference")
                elif k == "availability":
                    unmet_reasons.append("unavailable on your event date")

        if not active_keys:
            return "Matches your general search criteria."

        if not unmet_reasons:
            if len(met_dims) == 1:
                return f"Meets your {met_dims[0]} requirement."
            if len(met_dims) == 2:
                return f"Meets your {met_dims[0]} and {met_dims[1]} requirements."
            return f"Meets your {', '.join(met_dims[:-1])}, and {met_dims[-1]} requirements."

        if met_dims:
            met_str = " and ".join(met_dims) if len(met_dims) <= 2 else f"{', '.join(met_dims[:-1])}, and {met_dims[-1]}"
            unmet_str = "; ".join(unmet_reasons)
            return f"Meets your {met_str} requirements, but {unmet_str}."

        return f"Partial match — {'; '.join(unmet_reasons)}."


