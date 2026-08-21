from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
<<<<<<< Updated upstream
from app.api.routes import auth, users, vendors, bookings, admin, services, uploads, vendor_bookings, reviews, checklist, favorites
=======
from app.api.routes import auth, users, vendors, bookings, admin, services, uploads, vendor_bookings, reviews, checklist, favorites, chatbot, chat
>>>>>>> Stashed changes
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

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    print(f"[GLOBAL EXCEPTION] {type(exc).__name__}: {exc}")
    traceback.print_exc()
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal Server Error"}
    )

# Explicit allowed origins (localhost dev + known production URLs)
ALLOWED_ORIGINS = settings.BACKEND_CORS_ORIGINS + [
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    # Also allow any localhost/127.0.0.1 port and any Vercel preview deployment.
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$|https://.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    try:
        await Database.connect_db()
    except Exception as e:
        print(f"[STARTUP WARNING] Database connection failed: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    try:
        await Database.close_db()
    except Exception as e:
        print(f"[SHUTDOWN WARNING] Database close failed: {e}")


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
<<<<<<< Updated upstream
=======
app.include_router(chatbot.router, prefix="/api/chatbot", tags=["Chatbot"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
>>>>>>> Stashed changes

@app.get("/")
async def root():
    return {"message": "PakWedding Portal API", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
