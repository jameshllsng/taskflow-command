# TaskFlow Command

TaskFlow Command is a collaborative task management web app with authentication, role-based access, live sync, assignment workflow, and in-app notifications.

## Highlights
- Login required to access the app
- Session timeout after 6 hours
- Default admin user (`admin` / `admin`)
- Admin user management (create, edit, delete users)
- Task assignment to users
- Task card metadata:
  - Opened by
  - Assigned to
  - Description
  - Status, due date, completion time
- Team sync without page reload
- Admin mass-delete view with compact cards and multi-select
- Popup + sound notifications for regular users:
  - new tasks created
  - tasks newly assigned to them

## Tech Stack
- Frontend: HTML, CSS, Vanilla JavaScript, Bootstrap 5
- Backend: Node.js `http` (no external server framework)
- Persistence: local JSON files in `data/`

## Project Structure
- `index.html` UI
- `style.css` styles
- `script.js` frontend logic
- `server.js` backend + API + static file server
- `data/tarefas.json` tasks storage
- `data/users.json` users storage

## Run Locally
### Prerequisites
- Node.js 18+

### Start
```bash
npm start
```

Open:
- `http://localhost:3000`

## Default Access
- Username: `admin`
- Password: `admin`

## Main API Endpoints
### Auth
- `POST /api/auth/login`
- `GET /api/auth/session`
- `POST /api/auth/logout`

### Tasks (authenticated users)
- `GET /api/tarefas`
- `PUT /api/tarefas`

### Users (admin only)
- `GET /api/users`
- `POST /api/users`
- `PUT /api/users/:id`
- `DELETE /api/users/:id`

### User options for assignment (any authenticated user)
- `GET /api/users/options`

## Notes
- If audio does not play initially, interact with the page once after login (browser autoplay policies).
- Data is file-based and suitable for local/small-team usage.
