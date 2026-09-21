from fastapi import APIRouter, HTTPException, status, Response, Depends
from sqlalchemy.orm import Session
from Schemas.user import Register, DeleteUser, Login
from Models import user
from Models.database import get_db
from Security.utils import (
    hash_password, 
    verify_password,
    get_current_user, 
    issue_auth_cookie,  
    issue_refresh_token, 
    issue_verification_token)
from Services.email import send_verification_email
from Services.reputation import get_tier

router = APIRouter()

@router.post("/register", status_code=status.HTTP_201_CREATED)
def reg_body(register: Register, response: Response, db: Session = Depends(get_db)):
    existing = db.query(user.User).filter(user.User.email == register.email).first()
    if existing: 
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="Email already exist")
    
    hashed = hash_password(register.password)

    new_user = user.User(
        name = register.name,
        email = register.email,
        password = hashed,
    )
    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
    except Exception:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to register")
    
    issue_auth_cookie(response,new_user)
    issue_refresh_token(response, new_user,db)
    token = issue_verification_token(new_user, db)
    send_verification_email(new_user.email, new_user.name, token)
    
    return {
        "message": "Account successfully registered",
        "data": {
            "id": new_user.id,
            "name": new_user.name,
            "email": new_user.email,
        }
    }
    
@router.post("/login")
def login(login: Login, response: Response,db: Session = Depends(get_db)):
    val_user = db.query(user.User).filter(user.User.email == login.email).first()
    
    if not val_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password")
        
    if not verify_password(login.password, val_user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Invalid email or password")
    
    issue_auth_cookie(response, val_user)
    issue_refresh_token(response, val_user,db)
    
    
    return {
        "user": {
            "id": val_user.id,
            "name": val_user.name,
            "email": val_user.email
        }
    }
    
@router.get("/users/me")
def get_profile(current_user: user.User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role,
        "is_verified": current_user.is_verified,
        "points": current_user.points,
        "tier": get_tier(current_user.points),
        # Lets the verify screen show a countdown on the resend button instead
        # of letting the user click it and receive a 429.
        "verification_expires_at": current_user.verification_token_expires_at,
    }

@router.delete("/users/{user_id}")
def user_delete(user_id: int , user_del: DeleteUser, db: Session = Depends(get_db),current_user: user.User=Depends(get_current_user)):
    find_id = db.query(user.User).filter(user.User.id == user_id).first()
    
    if not find_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Current User doesnt belong to this ID")
    if not verify_password(user_del.user_password, find_id.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Password doesn't match")

    try:
        db.delete(find_id)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete user")
    
    return{"message": "Account deleted successfully"}