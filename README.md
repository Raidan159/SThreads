# SThreads - Spaced Repetition Personal Knowledge Manager (PKM)

Welcome to **SThreads**, a Personal Knowledge Management (PKM) operating system combining an Infinite Canvas Timeline, Knowledge Graph Visualization, and Contextual Spaced Repetition reviews.

This document serves as the project's directory map and clean code guidelines for any future development or automated AI agent sessions.

---

## 🗺️ Project Architecture & File Map

### 1. Backend (`/backend`)
*   [main.py](file:///d:/Code/SThreads/backend/main.py): Entry point for the FastAPI server. Handles CORS, static file uploads mounting (`/uploads`), schema migration checks on startup, Pydantic schemas, and API routes.
*   [models.py](file:///d:/Code/SThreads/backend/models.py): SQLAlchemy models (`Space`, `KnowledgeNode`, `Edge`, `Flashcard`, `FSRSReview`) mapping to SQLite (`sthreads.db`).
*   [database.py](file:///d:/Code/SThreads/backend/database.py): Core database session setup and connection pragmas (enabling SQLite foreign keys).
*   [fsrs.py](file:///d:/Code/SThreads/backend/fsrs.py): Implements the FSRS v4 spaced repetition scheduling logic, interval calculation, and memory retrievability algorithms.
*   [schedulers.py](file:///d:/Code/SThreads/backend/schedulers.py): Implements classical SM-2 (Ease Factor & Repetitions) and Leitner (5-Box system) schedulers, along with human-readable interval formatters.
*   [embedding.py](file:///d:/Code/SThreads/backend/embedding.py): Vector embedding helpers and cosine similarity calculators.

### 2. Frontend (`/frontend/src`)
*   [App.jsx](file:///d:/Code/SThreads/frontend/src/App.jsx): Root frontend component. Coordinates global states, fetches server data, hosts sidebar node search/creation forms, and manages view-modes.
*   [components/AnkiSimulator.jsx](file:///d:/Code/SThreads/frontend/src/components/AnkiSimulator.jsx): Interactive simulation dashboard containing a review history constructor, comparative parameter table, and an SVG line chart plotting interval growth.
*   [components/ReviewModal.jsx](file:///d:/Code/SThreads/frontend/src/components/ReviewModal.jsx): Flashcard review overlay. Renders synonyms, images, audio players, context graphs, and predicted review intervals.
*   [components/CanvasTimeline.jsx](file:///d:/Code/SThreads/frontend/src/components/CanvasTimeline.jsx): PixiJS canvas rendering nodes along time and topic space coordinates.
*   [components/GraphView.jsx](file:///d:/Code/SThreads/frontend/src/components/GraphView.jsx): D3/React-flow visualization of local networks of related nodes.
*   [components/ControlDock.jsx](file:///d:/Code/SThreads/frontend/src/components/ControlDock.jsx): Floating control panel for time playback, slider interactions, and view modes.
*   [index.css](file:///d:/Code/SThreads/frontend/src/index.css): Unified CSS stylesheets containing design tokens, animations, layouts, and simulator styles.

---

## 🗃️ Spaced Repetition Database Columns Overloads

To maintain database schema simplicity, the `FSRSReview` table columns are reused across schedulers:

| Scheduler | `stability` Column | `difficulty` Column | `state` Column |
| :--- | :--- | :--- | :--- |
| **FSRS** | Stability value (float) | Difficulty value (float) | Review state (integer) |
| **SM-2** | Ease Factor (float) | Repetitions count (float) | Scheduled Interval in days (integer) |
| **Leitner** | Not used (`0.0`) | Box number (float) | Box number (integer) |

---

## 🧼 Clean Code Rules for SThreads

To maintain a premium, stable, and highly maintainable codebase, adhere to these guidelines:

### 1. Strict Separation of Concerns
*   **Algorithms**: Keep scheduling math strictly inside `fsrs.py` or `schedulers.py`. Do not perform scheduling calculations directly inside routes or frontend components.
*   **API Handlers**: Keep API route definitions in `main.py` lean. Use them only to validate request payloads, coordinate services, interact with the DB session, and return formatted responses.

### 2. Database Schema Safety
*   When adding new columns, implement startup verification checks inside `main.py` (before `create_all`) to prevent runtime crashes caused by outdated local SQLite schemas.
*   Cascade deletions properly: deleting a `KnowledgeNode` must automatically delete its related `Flashcard` and `Edge` linkages (`cascade="all, delete-orphan"`).

### 3. API Contract and Typings
*   Always use Pydantic models for request bodies and response mapping.
*   Avoid sending raw JSON objects to the client. Keep schemas descriptive (e.g. `FlashcardOut`, `SimulationRequest`).

### 4. Resilient Frontend Component Design
*   **Null Checks**: Always check for existence before rendering optional fields (`image_url`, `audio_url`, `synonyms`). Use optional chaining (`?.`) or conditional statements.
*   **Design Tokens**: Maintain a cohesive visual language by using CSS variables from `:root` in `index.css` (like `--bg-primary`, `--accent-blue`, `--transition-smooth`). Do not write arbitrary inline colors.
*   **SVG Rendering**: Compute SVG dimensions dynamically. Ensure line plots scale cleanly using a padding buffer and handle cases with single/empty coordinate arrays without throwing errors.

---

## 🚀 How to Run the Project

### 1. Khởi chạy Backend (FastAPI + Uvicorn)
Từ thư mục gốc của dự án (`d:\Code\SThreads`), chạy các lệnh sau:
```bash
# Cài đặt các thư viện Python cần thiết (nếu chưa cài)
pip install fastapi uvicorn sqlalchemy pydantic python-multipart

# Chạy server FastAPI ở cổng 8000
python -m uvicorn backend.main:app --port 8000 --reload
```
*   Tài liệu Swagger API sẽ có tại: `http://127.0.0.1:8000/docs`
*   *Lưu ý*: Server tự động kiểm tra schema cơ sở dữ liệu khi khởi động. Nếu schema cũ, nó sẽ tự động tạo lại tệp `sthreads.db`. Bạn có thể truy cập phương thức POST `/api/seed` để nạp lại dữ liệu mẫu Star Wars.

### 2. Khởi chạy Frontend (React + Vite)
Từ thư mục frontend (`d:\Code\SThreads\frontend`), chạy các lệnh sau:
```bash
# Cài đặt các thư viện NodeJS (nếu là lần đầu)
npm install

# Khởi chạy server development của Vite
npm run dev
```
*   Giao diện người dùng sẽ chạy tại địa chỉ: `http://localhost:5173`

