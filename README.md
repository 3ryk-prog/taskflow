# TaskFlow — Task Manager

Aplikacja do zarządzania zadaniami z autoryzacją JWT.  
**Stack:** React + Vite (frontend) · FastAPI + SQLite (backend)

---

## Funkcjonalności

- Rejestracja i logowanie (JWT)
- Dodawanie, edytowanie, usuwanie zadań
- Priorytety zadań (niski / średni / wysoki)
- Oznaczanie zadań jako ukończone
- Filtrowanie (wszystkie / aktywne / ukończone / pilne)
- Statystyki i pasek postępu
- Persystencja danych w SQLite

---

## Uruchomienie

### Backend (FastAPI)

```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

API dostępne pod: `http://localhost:8000`  
Dokumentacja Swagger: `http://localhost:8000/docs`

### Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

Aplikacja dostępna pod: `http://localhost:5173`

---

## Struktura projektu

```
taskmanager/
├── backend/
│   ├── main.py           # FastAPI app — modele, schematy, endpointy
│   ├── requirements.txt
│   └── taskmanager.db    # SQLite (tworzy się automatycznie)
└── frontend/
    ├── src/
    │   ├── App.jsx       # Główna aplikacja, komponenty, auth context
    │   └── index.css     # Style
    ├── index.html
    ├── package.json
    └── vite.config.js
```

---

## API Endpoints

| Metoda | Endpoint | Opis |
|--------|----------|------|
| POST | `/auth/register` | Rejestracja |
| POST | `/auth/login` | Logowanie |
| GET | `/auth/me` | Zalogowany użytkownik |
| GET | `/tasks` | Lista zadań |
| POST | `/tasks` | Nowe zadanie |
| PATCH | `/tasks/{id}` | Aktualizacja zadania |
| DELETE | `/tasks/{id}` | Usunięcie zadania |
| GET | `/tasks/stats` | Statystyki |

---

## Deployment

**Backend** → Railway / Render (darmowy plan)  
**Frontend** → Vercel / Netlify (`npm run build` → folder `dist`)

---

## Tech Stack

- **Frontend:** React 18, Vite, CSS Variables
- **Backend:** FastAPI, SQLAlchemy, SQLite
- **Auth:** JWT (python-jose), bcrypt (passlib)
- **Komunikacja:** REST API, fetch
