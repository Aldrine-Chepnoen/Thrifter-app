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

## Entry: April 3, 2026 (Continued)
### Task: Fix Search Race Condition (Reverting Results)

**Objective:**
Fix the issue where search results would briefly appear and then be overwritten by the regular homepage items.

**Root Cause Analysis:**
A race condition existed between the initial `fetchItems()` (called on mount) and the `handleSearch()` call. If the initial "fetch all" request was slow, it would finish *after* the search request, calling `setItems()` with the full list and overwriting the search results.

**Changes Implemented in `frontend/src/App.jsx`:**

1.  **Request Tracking (requestIdRef):**
    - Introduced a `requestIdRef` to track the "freshness" of data requests.
    - Every time `fetchItems` or `handleSearch` starts a new API call, it increments this ref and captures the value.
    - Before updating the state (`setItems` or `setLoading`), the code now verifies that the captured ID still matches `requestIdRef.current`.
    - **Result:** Stale responses from older or superseded requests are now ignored, ensuring that only the most recent user action determines what is displayed.

**Verification:**
- [x] Slow initial fetches no longer overwrite faster subsequent searches.
- [x] Search results remain stable and do not "revert" to the default feed.

## Entry: April 3, 2026 (Continued)
### Task: Final Search Race Condition Fix (AbortController & Pagination)

**Objective:**
Eliminate the "0.001 second" jump where search results were being overwritten by a late-arriving "fetch all items" request.

**Changes Implemented in `frontend/src/App.jsx`:**

1.  **Request Cancellation (AbortController):**
    - Integrated `AbortController` into both `fetchItems` and `handleSearch`.
    - Every time a new search is started or the bar is cleared, the app now **physically cancels** the previous network request if it's still in flight.
    - **Result:** This stops the race condition at the source. The browser will ignore any data from a cancelled request, so it can never overwrite new search results.

2.  **Pagination (Home Feed):**
    - Refactored `fetchItems` to support `skip` and `limit` parameters (fetching 20 items at a time).
    - Added a **"Load More"** button at the bottom of the feed.
    - **Result:** The "Empty" trigger (clearing the search bar) is now much faster because it only fetches a small portion of items instead of the whole database. This significantly reduces the performance load and further stabilizes the UI.

**Verification:**
- [x] Rapid typing and clearing no longer causes the feed to "jump" or revert.
- [x] Network tab confirms that superseded requests are marked as `(canceled)`.
- [x] Initial home page load is faster due to smaller data payload.
- [x] "Load More" button successfully appends new items to the grid.

## Entry: April 3, 2026 (Continued)
### Task: Implement True Infinite Scroll

**Objective:**
Provide a seamless "Pinterest-style" discovery experience where items load automatically as the user scrolls, eliminating the jarring page jump caused by the "Load More" button.

**Changes Implemented in `frontend/src/App.jsx`:**

1.  **Background Loading State (`loadingMore`):**
    - Split the loading state into `loading` (for initial, full-screen spinner) and `loadingMore` (for background appending).
    - **Result:** The UI no longer disappears and jumps to the top when fetching new items; the existing grid stays on screen while new items are added at the bottom.

2.  **Scroll Event Listener:**
    - Added a `useEffect` with a `window` scroll listener that triggers `fetchItems(false)` when the user is within 500px of the bottom of the page.
    - Implemented logic to prevent duplicate requests (checking `loadingMore` and `hasMore`).

3.  **UI Enhancements:**
    - Removed the manual "Load More" button.
    - Added a subtle loading spinner at the bottom of the feed that only appears during background loads.
    - Added a "End of collection" footer to provide visual closure to the user.

**Verification:**
- [x] Items load automatically as the user scrolls down.
- [x] Page position is preserved (no jumping to the top).
- [x] "End of collection" message appears correctly when no more items are available.
- [x] Scroll listener is properly cleaned up on component unmount.

## Entry: April 3, 2026 (Continued)
### Task: Fix Grid Shuffling (Stable Masonry Grid)

**Objective:**
Eliminate the "mumbled movement" where items would jump between columns when new data was appended via infinite scroll.

**Root Cause Analysis:**
The use of CSS `column-count` caused the browser to re-balance all items across columns every time the list changed. This meant items at the top would shift left or right to accommodate new items at the bottom.

**Changes Implemented in `frontend/src/components/MasonryGrid.jsx`:**

1.  **Manual Column Distribution:**
    - Abandoned CSS `column-count` in favor of a manual "stack" distribution logic.
    - Added a `window` resize listener to dynamically determine the number of columns (2 to 5) based on screen width.
    - Distributed items using a modulo operation (`index % columnCount`) into separate column arrays.
    - **Result:** Since each column is now a distinct vertical flex container, adding new items only affects the bottom of each column. Existing items remain perfectly stationary.

**Verification:**
- [x] Items no longer jump between columns when scrolling down.
- [x] Grid remains responsive to window resizing.
- [x] Infinite scroll feels smooth and anchored.

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
