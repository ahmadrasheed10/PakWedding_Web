"""
Script to update existing vendors with packages
Run this script to add packages to vendors that don't have them
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
from app.repositories.vendor_repository import VendorRepository

# Category-based pricing
CATEGORY_PRICES = {
    "Photography": {"basic": 50000, "standard": 100000, "premium": 200000},
    "Caterer": {"basic": 80000, "standard": 150000, "premium": 300000},
    "Decorator": {"basic": 60000, "standard": 120000, "premium": 250000},
    "Venue": {"basic": 100000, "standard": 200000, "premium": 400000},
    "Makeup Artist": {"basic": 30000, "standard": 60000, "premium": 120000},
    "DJ": {"basic": 40000, "standard": 80000, "premium": 150000},
    "Florist": {"basic": 25000, "standard": 50000, "premium": 100000},
    "Mehndi": {"basic": 20000, "standard": 40000, "premium": 80000},
    "Videography": {"basic": 60000, "standard": 120000, "premium": 250000},
}

DEFAULT_PRICES = {"basic": 50000, "standard": 100000, "premium": 200000}


async def update_vendors_with_packages():
    """Update existing vendors to add packages if they don't have them"""
    print("Updating vendors with packages...")
    
    # Connect to database
    client = AsyncIOMotorClient(settings.DATABASE_URL)
    db = client[settings.DATABASE_NAME]
    vendor_repo = VendorRepository(db)
    
    # Get all vendors
    vendors = await vendor_repo.find_many({}, 0, 1000)
    
    updated_count = 0
    skipped_count = 0
    
    for vendor in vendors:
        try:
            vendor_id = str(vendor.get("_id"))
            service_category = vendor.get("service_category", "Other")
            
            # Check if vendor already has packages
            if "packages" in vendor and vendor["packages"] and len(vendor["packages"]) > 0:
                print(f"[SKIP] {vendor.get('business_name')} already has packages")
                skipped_count += 1
                continue
            
            # Get prices for this category
            prices = CATEGORY_PRICES.get(service_category, DEFAULT_PRICES)
            
            # Create packages
            packages = [
                {
                    "name": "Basic",
                    "price": float(prices["basic"]),
                    "description": f"Basic {service_category} package - Perfect for intimate celebrations",
                    "features": [
                        "Standard service coverage",
                        "Basic setup and delivery",
                        "Digital documentation",
                        "Email support"
                    ]
                },
                {
                    "name": "Standard",
                    "price": float(prices["standard"]),
                    "description": f"Standard {service_category} package - Ideal for most weddings",
                    "features": [
                        "Enhanced service coverage",
                        "Extended hours",
                        "Premium delivery",
                        "Priority support",
                        "Additional team members"
                    ]
                },
                {
                    "name": "Premium",
                    "price": float(prices["premium"]),
                    "description": f"Premium {service_category} package - Luxury experience",
                    "features": [
                        "Full premium service",
                        "Complete coverage",
                        "Priority delivery",
                        "Dedicated support team",
                        "Exclusive features",
                        "Post-event follow-up"
                    ]
                }
            ]
            # Update vendor with packages
            await vendor_repo.update(vendor_id, {"packages": packages})
            print(f"[OK] Updated {vendor.get('business_name')} ({service_category}) with packages")
            updated_count += 1
            
        except Exception as e:
            print(f"[ERROR] Error updating {vendor.get('business_name', 'Unknown')}: {e}")
    
    print(f"\n[SUMMARY]")
    print(f"   Updated: {updated_count} vendors")
    print(f"   Skipped: {skipped_count} vendors")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(update_vendors_with_packages())

