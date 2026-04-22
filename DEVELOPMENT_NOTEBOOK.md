# Thrifter Development Notebook
## Entry: April 3, 2026
### Task: Enforce Authentication on Initial Load 
**Objective:** 
-Modify the application so that the login/signup page is the first thing a user sees, and restrict access to all features (Feed, AI Search, Wardrobe, etc.) until authentication is successful.

**Changes Implemented in `frontend/src/App.jsx`:**
1.  **Initial Authentication Check:** 
-Refactored the `useEffect` hook into a more robust `initApp` async function.
- It now verifies the existence of a `thrifter_token` in `localStorage` and attempts to fetch user data (`/auth/me`) before any other data fetching.
- If the token is invalid or expired, it is automatically removed.

2.  **Splash Loading Screen:**
- Added a full-screen loading spinner that displays while `loading` is true and `user` is null.
- This prevents the "flash" of the login screen for users  who are already authenticated while their session is being restored.

3.  **Conditional Rendering of Navigation:**
- Wrapped the `Navbar` component in a `{user && ...}` check. The navigation bar is now hidden until the user is logged in.

4.  **Protected Routing Logic:**
- Updated the `<Routes>` container to use a conditional check on the `user` state.
- **Unauthenticated State:** A catch-all route (`*`) renders the `Auth` component. This ensures that any deep-linked URL (like `/upload` or `/wardrobe`) redirects to login if the user is not authenticated.
- **Authenticated State:** Reveals the main application routes, including the Home feed, Upload form, Vendor pages, and Wardrobe.

5. **Post-LoginDataFlow:**                              - Updated the `Auth` component's `onAuthed` callback to trigger `fetchItems()` immediately upon successful login/registration, ensuring the feed is ready as soon as the user enters the app.

**Verification:**                                 
- [x] Users without a token see the Login page.
- [x] Users with a valid token are greeted with a loading spinner followed by the main feed.
- [x] Navigation bar is inaccessible until login.
- [x] Manual URL entry for protected paths redirects to login for unauthenticated users.

## Entry: April 3, 2026 (Continued)
### Task: Fix Search Bug (Debouncing)

**Objective:**
Address the "buggy" search behavior where results sometimes feel unrelated or jump around while typing.

**Changes Implemented in `frontend/src/App.jsx`:**

1.  **Search Debouncing:**
    - Introduced `searchTimeoutRef` using `useRef`.
    - Modified `handleSearch` to clear any existing timeout before setting a new one.
    - Set a 500ms delay for the API call. 
    - **Result:** The app now waits for the user to pause typing before sending the search request. This prevents race conditions where an older, shorter query might finish after a newer, longer query and overwrite the results.

**Verification:**
- [x] Rapidly typing "jacket" only triggers one API call to `/search?query=jacket`.
- [x] Clearing the search bar triggers `fetchItems()` after 500ms.
- [x] UI no longer flickers between different result sets while typing.

## Entry: April 6, 2026
### Task: Restrict Search Bar to Main Home Page Only
**Objective:**
- Modify the `Navbar` component to exclude the search bar on specific pages (Login, Vendor, and Wardrobe) and ensure it is only rendered on the main home page (`/`). Additionally, correct the logo's navigation link.

**Changes Implemented in `frontend/src/components/Navbar.jsx`:**

1.  **Conditional Search Bar Rendering:**
- Imported `useLocation` from `react-router-dom`.
- Implemented logic to check if the current path (`location.pathname`) is exactly `/`.
- Wrapped the search bar's container in a conditional block (`{isHomePage && ...}`) so it is completely omitted from the DOM on all other routes.

2.  **Logo Link Correction:**
- Updated the "Thrifter" logo's `Link` to point correctly to the home page (`/`) instead of the authentication page (`/auth`).

- **Verification:**
- [x] Search bar is visible and functional on the home page(`/`).
- [x] Search bar is completely excluded from the DOM on the login page (`/auth`).
- [x] Search bar is completely excluded from the DOM on vendor pages (`/vendor/:name`).
- [x] Search bar is completely excluded from the DOM on the wardrobe page (`/wardrobe`).
- [x] Clicking the "Thrifter" logo correctly navigates back to the home page.

## [2026-04-06] - Navbar Update on Login Page

### Changes:
- Modified `frontend/src/App.jsx` to conditionally render the header.
- On the `/auth` (login) route, the standard `Navbar` is replaced with a centered, unclickable "Thrifter" logo.
- The "Thrifter" logo is styled as an `h1` with `font-serif`, `font-bold`, and `text-4xl` for a prominent, minimal look.
- The standard `Navbar` remains active and functional for all other routes to ensure search and navigation features are preserved where needed.

### Rationale:
Simplified the authentication entry point to provide a cleaner, more focused user experience, while maintaining functionality on the main application pages.
