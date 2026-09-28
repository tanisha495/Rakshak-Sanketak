from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.core.db import SessionLocal
from app.core.security import hash_password, verify_password, create_access_token
from app.models.hse_user import HSEUser

router = APIRouter(prefix="/auth", tags=["auth"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post(
    "/register",
    summary="Register a new HSE staff account",
    description="Creates a new HSE staff login with a hashed password and assigned role "
                "(viewer, editor, or admin). Intended for internal use by OIL's HSE team.",
)
def register(email: str, password: str, role: str = "viewer", db: Session = Depends(get_db)):
    existing = db.query(HSEUser).filter(HSEUser.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = HSEUser(email=email, hashed_password=hash_password(password), role=role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "email": user.email, "role": user.role}

@router.post(
    "/login",
    summary="Log in as HSE staff",
    description="Authenticates an HSE staff account and returns a JWT access token, required "
                "to access all HSE-facing endpoints (reports, risk-radar, patterns, precedents, actions).",
)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(HSEUser).filter(HSEUser.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(data={"sub": user.email, "role": user.role})
    return {"access_token": token, "token_type": "bearer"}