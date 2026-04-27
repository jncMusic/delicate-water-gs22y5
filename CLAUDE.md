# CLAUDE.md - JnC Music Academy Dashboard

## Project Overview

This is the **JnC Music Academy Dashboard** — a React-based web application for managing a music academy's daily operations including student enrollment, teacher scheduling, attendance tracking, payment management, and consultation logging. The UI and all comments/data are in **Korean**.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 (JavaScript/JSX, Create React App) |
| Styling | Tailwind CSS 3 (loaded via CDN in `public/index.html`) |
| Icons | lucide-react |
| Backend/DB | Firebase (Firestore) with anonymous authentication |
| Excel I/O | xlsx |
| Screenshots | html2canvas |
| Package manager | pnpm |
| Build tool | react-scripts 5.0.1 |

## Commands

```bash
pnpm install          # Install dependencies
pnpm start            # Start dev server on port 3000
pnpm build            # Production build
pnpm test             # Run tests (Jest via react-scripts, --env=jsdom)
```

There are no test files currently in the repository.

## Project Structure

```
├── homepage/                 # ★ jncmusic.kr 공개 홈페이지 (Next.js App Router)
│   ├── app/
│   │   ├── layout.js         # 메타데이터 (SEO, 구글/네이버 인증 코드 포함)
│   │   ├── page.js           # 메인 페이지
│   │   └── globals.css
│   └── vercel.json           # Vercel 배포 설정
├── public/
│   └── index.html            # SPA entry, loads Tailwind CDN
├── src/
│   ├── index.js              # React root mount (StrictMode)
│   ├── App.js                # Main application (~8,200 lines, single-file)
│   ├── JNCDashboard.js       # Older/alternative dashboard version (unused)
│   ├── styles.css            # Minimal base styles
│   └── .env                  # Environment variables (REACT_APP_FIREBASE_apiKey, REACT_APP_ADMIN_PW)
├── .codesandbox/
│   └── tasks.json            # CodeSandbox dev task definitions
├── .eslintrc.json            # Minimal ESLint config (TypeScript parser, no rules)
├── package.json
└── pnpm-lock.yaml
```

> **중요**: `jncmusic.kr` 공개 홈페이지는 별도 레포가 아니라 이 레포의 `homepage/` 폴더에 있는 Next.js 프로젝트입니다. SEO 메타태그, 구글/네이버 서치콘솔 인증 코드는 `homepage/app/layout.js`의 `metadata.verification`에서 관리합니다.

### Architecture Notes

- **Monolithic single-file architecture**: Nearly all application logic lives in `src/App.js`. This includes all views, modals, helpers, constants, and Firebase operations.
- **No component splitting**: Views and modals are defined as inner functions/components within `App.js`.
- **No routing library**: Navigation is state-driven via `currentView` state variable, rendered through a large conditional block.
- **JNCDashboard.js** is not imported anywhere and appears to be a legacy version.

## Key Application Modules (all in App.js)

### Views (rendered based on `currentView` state)
- **DashboardView** — Statistics overview and summary cards
- **TeacherTimetableView** — Teacher schedules with part filtering (Piano, Orchestral, Practical, Vocal)
- **SubjectTimetableView** — Subject-based timetable for external sharing
- **CalendarView** — Monthly calendar with lesson scheduling
- **ClassLogView** — Class session logging with instructor notes
- **AttendanceView** — Student attendance tracking (present/absent/late/excused)
- **StudentView** — Student CRUD, registration, and profile editing
- **PaymentView** — Tuition fee tracking and payment history
- **ConsultationView** — Prospective student consultation management
- **ReportView** — Report generation and management
- **SettingsView** — Admin settings, teacher management

### Modal Components
- LoginModal, EditTeacherModal, StudentEditModal, PaymentDetailModal
- AttendanceActionModal, FastAttendanceModal, FastPaymentModal
- StudentModal, AttendanceDetailModal, ReasonInputModal, DateDetailModal

## Firebase / Firestore Structure

```
artifacts/{APP_ID}/public/data/
├── students/         # Student records (attendance, payments, schedule, grades)
├── teachers/         # Teacher info (name, password, schedule, subjects)
├── consultations/    # Consultation/inquiry records
└── reports/          # Generated report documents
```

- **APP_ID**: `jnc-music-v2`
- Authentication: Anonymous Firebase auth (`signInAnonymously`)
- Real-time sync: All collections use `onSnapshot()` listeners
- Write patterns: `addDoc`, `updateDoc`, `setDoc`, `deleteDoc`, `writeBatch`

## Constants & Data Patterns

- **Days of week**: Korean labels `["월","화","수","목","금","토","일"]` (Mon-Sun), with id 1=Mon through 6=Sat, 0=Sun
- **Teacher list**: Hardcoded in `INITIAL_TEACHERS_LIST` with a `seedData()` function for initialization
- **Grade levels**: Korean education levels from preschool (미취학) through adult (성인)
- **Parts/Sections**: Piano (피아노), Orchestral (관현악), Practical (실용음악), Vocal (성악)
- **Operating hours**: Weekday 10:30-22:00, Weekend 09:00-22:00
- **Holiday calendar**: Hardcoded dates for 2025-2026

## Code Conventions

- **Language**: All UI text, comments, variable names for domain data, and commit messages are in Korean
- **Styling**: Tailwind CSS utility classes applied inline in JSX; minimal use of `styles.css`
- **State management**: React `useState` / `useEffect` / `useMemo` / `useCallback` hooks only (no external state library)
- **No TypeScript**: Despite `.eslintrc.json` referencing a TS parser and TS devDependencies, all source files are `.js`
- **No tests**: No test files exist yet
- **No CI/CD pipeline**: Runs on CodeSandbox; tasks defined in `.codesandbox/tasks.json`

## Development Guidelines

### When modifying this codebase:

1. **All changes go into `src/App.js`** unless you are refactoring to separate components (get explicit approval first).
2. **Preserve Korean text** in UI strings, comments, and toast messages. Do not translate to English.
3. **Tailwind classes** are the styling mechanism — do not add custom CSS unless absolutely necessary.
4. **Firebase operations** should follow existing patterns: use `onSnapshot` for reads, `updateDoc`/`addDoc` for writes, and `writeBatch` for multi-document operations.
5. **Test manually** via `pnpm start` since there are no automated tests. Verify in the browser at `http://localhost:3000`.
6. **Be cautious with the monolithic file** — search carefully for the right section before editing, as there are 8,000+ lines with many similarly-structured components.

### Section markers in App.js

The file uses comment blocks like:
```js
// =================================================================
// 1. Firebase 설정
// =================================================================
```
to delineate major sections. Follow this pattern when adding new sections.

### Adding a new view

1. Create a new component function (e.g., `const NewView = () => { ... }`) inside `App.js`
2. Add a navigation entry in the sidebar menu array
3. Add a case in the view rendering conditional block
4. Follow existing patterns for Firestore data fetching and state management

### Adding a new modal

1. Add state variables: `const [showNewModal, setShowNewModal] = useState(false)`
2. Create the modal component following existing modal patterns (overlay + centered card)
3. Render it conditionally at the bottom of the main return block

## Security Considerations

- Firebase config and credentials are hardcoded in `src/App.js` (lines 77-85)
- Teacher passwords are hardcoded in the source
- Admin password is stored in `src/.env` as `REACT_APP_ADMIN_PW`
- Do not commit additional secrets or API keys to the repository
