from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from app.api.routes import auth, users, vendors, bookings, admin, services, uploads, vendor_bookings, reviews, checklist, favorites
from app.core.config import settings
from app.core.database import Database

app = FastAPI(
    title="PakWedding Portal API",
    description="Wedding planning portal backend with vendor management",
    version="1.0.0"
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    
    errors = exc.errors()
    error_details = []
    for error in errors:
        field = ".".join(str(loc) for loc in error.get("loc", []))
        message = error.get("msg", "Validation error")
        error_details.append(f"{field}: {message}")
    
    error_message = "; ".join(error_details)
    print(f"[VALIDATION ERROR] {error_message}")
    print(f"[VALIDATION ERROR] Full error: {errors}")
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": error_message, "errors": errors}
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    await Database.connect_db()

@app.on_event("shutdown")
async def shutdown_event():
    await Database.close_db()


app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(vendors.router, prefix="/api/vendors", tags=["Vendors"])
app.include_router(bookings.router, prefix="/api/bookings", tags=["Bookings"])
app.include_router(services.router, prefix="/api/services", tags=["Services"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(uploads.router, prefix="/api/uploads", tags=["Uploads"])
app.include_router(vendor_bookings.router, prefix="/api/vendor", tags=["Vendor Bookings"])
app.include_router(reviews.router, prefix="/api/reviews", tags=["Reviews"])
app.include_router(checklist.router, prefix="/api/checklist", tags=["Checklist"])
app.include_router(favorites.router, prefix="/api/favorites", tags=["Favorites"])

@app.get("/")
async def root():
    return {"message": "PakWedding Portal API", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

