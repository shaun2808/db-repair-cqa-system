# Database Repair & Consistent Query Answering App

This project is a full-stack application with a React frontend and a Flask backend (Python) connected to a MySQL database. It allows users to:

- Import inconsistent relational data (CSV or SQL)
- Repair the data to satisfy integrity constraints (minimal changes)
- Run queries on repaired
- Check if a repair is possible
- Export the repaired database

## Getting Started

### Backend (Flask)
1. Install Python 3.11+ and MySQL.
2. Set up a MySQL database and update credentials in `backend/app.py` or use environment variables.
3. Create a virtual environment and install dependencies:
   ```
   python -m venv .venv
   .venv\Scripts\activate  # Windows
   pip install -r requirements.txt
   ```
4. Run the backend:
   ```
   python app.py
   ```

### Frontend (React)
1. Navigate to the `frontend` folder:
   ```
   cd frontend
   ```
2. Install dependencies:
   ```
   npm install
   ```
3. Start the frontend:
   ```
   npm start
   ```

## Development
- Backend: `backend/app.py`
- Frontend: `frontend/src/`

