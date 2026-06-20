# Revamped Elements Layer Ordering Manager

Revamp the elements layer ordering manager in the right sidebar (`RightSidebar.jsx`) to improve usability in dense canvas environments.

## User Review Required

No new external packages or dependencies will be introduced. Emojis and standard Tailwind styling will be used.

## Proposed Changes

### Client Sidebar Component

#### [MODIFY] [RightSidebar.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/sidebar/RightSidebar.jsx)
- Add `searchQuery` (string) and `activeFilter` (`'all' | 'selected' | 'images' | 'shapes'`) states.
- Increase layer list viewport height constraint from `max-h-80` to `max-h-[450px]`.
- Add search input and category filter chips at the top of the layers list.
- Import `getFullUrl` from `../../lib/url.js` to render thumbnail images for image elements.
- Render styled color swatches for shape/path elements using their exact fill or stroke color.
- Add quick ordering buttons `⏫` (Bring to Front) and `⏬` (Send to Back) next to forward/backward shift buttons.
- Add Locate/Focus eye button `👁️` that selects the element and triggers `setLocateElementTrigger`.

### Client Core State

#### [MODIFY] [uiStore.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/state/uiStore.js)
- Add `locateElementTrigger` (string/null) state.
- Export `locateElementTrigger` and `setLocateElementTrigger` in `UiContext`.

### Client App Orchestrator

#### [MODIFY] [AppContent.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/app/AppContent.jsx)
- Destructure `locateElementTrigger` and `setLocateElementTrigger` from `useUiStore`.
- Pass `setLocateElementTrigger` prop to `RightSidebar`.
- Pass `locateElementTrigger` and `setLocateElementTrigger` props to `Canvas`.

### Client Canvas Viewport

#### [MODIFY] [Canvas.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/canvas/Canvas.jsx)
- Receive `locateElementTrigger` and `setLocateElementTrigger` as props.
- Add `useEffect` to listen to `locateElementTrigger` changes. When triggered, center the viewport (panOffset) on the element's center coordinates based on current zoom scale, then reset the trigger.

## Verification Plan

### Automated Tests
- Run `npm --prefix client run lint` to ensure zero ESLint warnings or errors.
- Run `npm --prefix client run test -- --coverage --run` to verify all unit tests pass.
- Run `npm --prefix client run build` to verify production Vite build is successful.

### Manual Verification
- Spawn multiple rectangle, circle, and image elements.
- Verify filtering and searching in the sidebar updates elements list dynamically.
- Verify clicking `👁️` selects the element and pans/centers the viewport on the element.
- Verify clicking `⏫` and `⏬` moves the element to the front and back of the layers respectively.
