from fastapi import APIRouter, HTTPException, status, Response, Depends
from sqlalchemy.orm import Session
from Schemas.user import Register, DeleteUser, Login
from Models import user
from Models.database import get_db
from Security.utils import hash_password, verify_password, create_access_token,get_current_user,  ACCESS_TOKEN_EXPIRE_MINUTES
from datetime import timedelta

router = APIRouter()

@router.post("/register", status_code=status.HTTP_201_CREATED)
def reg_body(register: Register, db: Session = Depends(get_db)):
    existing = db.query(user.User).filter(user.User.email == register.email).first()
    if existing: 
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="Email already exist")
    
    #hash the password before saving <3
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
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub":  val_user.email},
        expires_delta=access_token_expires
    )
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )
    
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