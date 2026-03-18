from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from passlib.context import CryptContext
from jose import JWTError, jwt
from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import Optional, List
import os

# ─── CONFIG ───────────────────────────────────────────────
SECRET_KEY = "zmien-ten-klucz-na-produkcji-na-losowy-string"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24h

DATABASE_URL = "sqlite:///./taskmanager.db"

# ─── DATABASE ─────────────────────────────────────────────
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ─── MODELS ───────────────────────────────────────────────
class UserModel(Base):
    __tablename__ = "users"
    id       = Column(Integer, primary_key=True, index=True)
    email    = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    tasks    = relationship("TaskModel", back_populates="owner", cascade="all, delete")

class TaskModel(Base):
    __tablename__ = "tasks"
    id          = Column(Integer, primary_key=True, index=True)
    title       = Column(String, nullable=False)
    description = Column(String, default="")
    completed   = Column(Boolean, default=False)
    priority    = Column(String, default="medium")  # low | medium | high
    created_at  = Column(DateTime, default=datetime.utcnow)
    owner_id    = Column(Integer, ForeignKey("users.id"))
    owner       = relationship("UserModel", back_populates="tasks")

Base.metadata.create_all(bind=engine)

# ─── AUTH ─────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Nieprawidłowy token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if user is None:
        raise credentials_exception
    return user

# ─── SCHEMAS ──────────────────────────────────────────────
class UserRegister(BaseModel):
    email: str
    username: str
    password: str

class UserOut(BaseModel):
    id: int
    email: str
    username: str
    created_at: datetime
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    priority: Optional[str] = "medium"

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    completed: Optional[bool] = None
    priority: Optional[str] = None

class TaskOut(BaseModel):
    id: int
    title: str
    description: str
    completed: bool
    priority: str
    created_at: datetime
    class Config:
        from_attributes = True

# ─── APP ──────────────────────────────────────────────────
app = FastAPI(title="Task Manager API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── AUTH ROUTES ──────────────────────────────────────────
@app.post("/auth/register", response_model=Token, status_code=201)
def register(data: UserRegister, db: Session = Depends(get_db)):
    if db.query(UserModel).filter(UserModel.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email już zajęty")
    if db.query(UserModel).filter(UserModel.username == data.username).first():
        raise HTTPException(status_code=400, detail="Nazwa użytkownika już zajęta")
    user = UserModel(
        email=data.email,
        username=data.username,
        password=hash_password(data.password)
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": user.id})
    return {"access_token": token, "token_type": "bearer", "user": user}

@app.post("/auth/login", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.username == form.username).first()
    if not user or not verify_password(form.password, user.password):
        raise HTTPException(status_code=401, detail="Nieprawidłowe dane logowania")
    token = create_access_token({"sub": user.id})
    return {"access_token": token, "token_type": "bearer", "user": user}

@app.get("/auth/me", response_model=UserOut)
def me(current_user: UserModel = Depends(get_current_user)):
    return current_user

# ─── TASK ROUTES ──────────────────────────────────────────
@app.get("/tasks", response_model=List[TaskOut])
def get_tasks(
    completed: Optional[bool] = None,
    priority: Optional[str] = None,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(TaskModel).filter(TaskModel.owner_id == current_user.id)
    if completed is not None:
        query = query.filter(TaskModel.completed == completed)
    if priority:
        query = query.filter(TaskModel.priority == priority)
    return query.order_by(TaskModel.created_at.desc()).all()

@app.post("/tasks", response_model=TaskOut, status_code=201)
def create_task(
    data: TaskCreate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = TaskModel(**data.dict(), owner_id=current_user.id)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task

@app.patch("/tasks/{task_id}", response_model=TaskOut)
def update_task(
    task_id: int,
    data: TaskUpdate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(TaskModel).filter(TaskModel.id == task_id, TaskModel.owner_id == current_user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Zadanie nie istnieje")
    for field, value in data.dict(exclude_unset=True).items():
        setattr(task, field, value)
    db.commit()
    db.refresh(task)
    return task

@app.delete("/tasks/{task_id}", status_code=204)
def delete_task(
    task_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(TaskModel).filter(TaskModel.id == task_id, TaskModel.owner_id == current_user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Zadanie nie istnieje")
    db.delete(task)
    db.commit()

@app.get("/tasks/stats")
def get_stats(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tasks = db.query(TaskModel).filter(TaskModel.owner_id == current_user.id).all()
    total = len(tasks)
    completed = sum(1 for t in tasks if t.completed)
    return {
        "total": total,
        "completed": completed,
        "pending": total - completed,
        "high": sum(1 for t in tasks if t.priority == "high" and not t.completed),
    }
