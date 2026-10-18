# Full-App Iconography Audit & Modernization Plan

## 🔍 Executive Summary: Why Icons Look Strange Right Now

An audit of all 13 UI components and rendering modules in `/client/src` revealed **four core iconography issues**:

1. **Wrong / Broken SVG Metaphors in Primary Toolbars**:
   - **Eraser Tool ([`CanvasDock.jsx`](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/canvas/CanvasDock.jsx#L152-L154))**: Renders an **X-in-a-circle ("Cancel / Error")** icon instead of an actual Eraser.
   - **Measurement / Ruler Tool ([`CanvasDock.jsx`](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/canvas/CanvasDock.jsx#L166-L168))**: Renders **`< >` code brackets inside a terminal box** instead of a Ruler with tick marks.
   - **Select Tool ([`CanvasDock.jsx`](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/canvas/CanvasDock.jsx#L110-L112))**: Uses `cursor-arrow-rays` (a tiny cursor surrounded by 7 starburst rays) rather than a clean vector pointer arrow.
   - **Clear All Drawings ([`CanvasDock.jsx`](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/canvas/CanvasDock.jsx#L195-L197))**: Renders an upside-down pyramid of horizontal lines (`M4 20h16M7 16h10...`) that looks like a signal antenna or text-alignment icon rather than clearing strokes.
   - **Set as Canvas Background ([`LeftSidebar.jsx`](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/sidebar/LeftSidebar.jsx#L328-L330))**: Combines a rectangular mountain path (`M2.25 15.75...`) with a circular outer border (`M21 12a9 9 0...`) so the bottom line pokes outside the circle.

2. **Clashing Mix of Glossy OS Emojis & Monochrome Vector SVGs**:
   - In [`CanvasDock.jsx`](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/canvas/CanvasDock.jsx#L219-L257), monochrome 2px-stroke SVGs sit right next to multi-color OS cartoon emojis (`🎨`, `🎲`, `⚙️`). Because emojis ignore CSS `currentColor`, active buttons (`bg-sky-500 text-white`) fail to turn the icon white and create low-contrast visual clashes.
   - In [`LeftSidebar.jsx`](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/sidebar/LeftSidebar.jsx#L731-L737) and [`InspectorWidget.jsx`](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/sidebar/InspectorWidget.jsx#L289-L293), the 5-column shape selector mixes white emojis (`⬜`, `⚪`), a red emoji (`🔺`), a yellow emoji (`⭐`), and a monochrome unicode character (`⬢`).
   - In [`RightSidebar.jsx`](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/sidebar/RightSidebar.jsx#L250-L301), layer ordering mixes blue media-player fast-forward emojis (`⏫`, `⏬`) with plain text triangles (`▲`, `▼`). Even when disabled (`disabled={isFirst}`), the `⏫`/`⏬` emojis remain bright blue.
   - In [`Lobby.jsx`](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/lobby/Lobby.jsx#L432), the loading indicator spins a cyclone emoji (`🌀` with `animate-spin`).

3. **Inconsistent Icons for the Exact Same Action**:
   - **Rename**: Uses an SVG pencil in `LeftSidebar.jsx`, but `✏️` emoji in `Header.jsx` and `TabButton.jsx`.
   - **Delete**: Uses an SVG trash can in `CanvasDock.jsx` and `LeftSidebar.jsx`, but `🗑️` emoji in `RightSidebar.jsx`, `InspectorWidget.jsx`, `TooltipInspector.jsx`, and `SavesModal.jsx`.
   - **Close / Clear**: Mixes SVG `X`, unicode `✕`, and unicode `×` across modals, tabs, and search inputs.
   - **Visibility / Locate**: Uses SVG `Eye` / `EyeOff` in `LeftSidebar.jsx`, but `👁️` emoji in `RightSidebar.jsx`.

4. **Cramped Emoji Controls**:
   - `🎨` is placed inside tiny 22–24px (`w-5.5 h-5.5` / `w-6 h-6`) color-picker circles in `LeftSidebar.jsx` and `InspectorWidget.jsx`, making it illegible at small sizes.

---

## 🗺️ Complete Component-by-Component Icon Audit

### 1. Bottom Toolbar Dock ([`CanvasDock.jsx`](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/canvas/CanvasDock.jsx))
| Control | Line | Current Icon | Problem | Proposed Modern Icon |
| :--- | :--- | :--- | :--- | :--- |
| Pen Custom Color | L53 | `+` text | Tiny uncentered text character | `Palette` / `Pipette` (12px SVG) |
| **Select Tool** | L110 | `cursor-arrow-rays` SVG | Cluttered starburst rays around tip | `MousePointer` (clean angled cursor arrow) |
| **Pan Tool** | L124 | Multi-loop hand SVG | Loops overlap awkwardly at 20px | `Hand` (clean open-palm vector icon) |
| **Pen Tool** | L138 | Pencil SVG | Good, but inline & unstandardized | `Pencil` / `PenTool` (shared 20px SVG) |
| **Eraser Tool** | L152 | `XCircle` SVG (`⊗`) | **Wrong metaphor**: looks like Cancel/Close | `Eraser` (angled prism eraser with baseline) |
| **Ruler Tool** | L166 | `< >` Code Box SVG | **Wrong metaphor**: looks like Code/Terminal | `Ruler` (angled ruler with measurement ticks) |
| **Delete Selected** | L185 | Trash SVG | Good, move to shared icon | `Trash2` (shared 20px SVG) |
| **Clear Drawings** | L195 | Stacked horizontal lines | **Strange metaphor**: looks like Wi-Fi/align | `Sparkles` / `Eraser` sweep (clear all strokes) |
| **Library Toggle** | L221 | `🎨` Emoji | Ignores `currentColor`, clashes when active | `Shapes` / `LayoutGrid` (20px SVG) |
| **Dice Roller Toggle**| L235 | `🎲` Emoji | Ignores `currentColor`, clashes when active | `Dices` (20px dual-dice vector SVG) |
| **Inspector Toggle** | L256 | `⚙️` Emoji | Ignores `currentColor`, clashes when active | `SlidersHorizontal` / `Layers` (20px SVG) |
| **Zen Mode Toggle** | L272 | Expand/Collapse SVG | Good, move to shared icon | `Maximize2` / `Minimize2` (shared 20px SVG) |

### 2. Top Workspace Bar ([`Header.jsx`](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/header/Header.jsx) & [`TabButton.jsx`](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/common/TabButton.jsx))
| Control | File & Line | Current Icon | Problem | Proposed Modern Icon |
| :--- | :--- | :--- | :--- | :--- |
| **Copy Invite** | `Header.jsx` L76 | `🔗` / `✓` | OS emoji link clashes with mono badge | `Link` / `Check` (12px SVG) |
| **Undo** | `Header.jsx` L97 | `↩️` Emoji | Stays colored when disabled | `Undo2` (14px SVG, inherits disabled color) |
| **Redo** | `Header.jsx` L112 | `↪️` Emoji | Stays colored when disabled | `Redo2` (14px SVG, inherits disabled color) |
| **Saves** | `Header.jsx` L122 | `💾` Emoji | Dated floppy cartoon | `Save` / `Bookmark` (14px SVG) |
| **Lobby** | `Header.jsx` L133 | `🚪` Emoji | Brown wooden door cartoon | `LogOut` / `LayoutGrid` (14px SVG) |
| **Online Users** | `Header.jsx` L164 | `👥` Emoji | Cartoon silhouette | `Users` (14px SVG) |
| **Rename User** | `Header.jsx` L239 | `✏️` Emoji | Inconsistent with SVG pencil | `Pencil` (12px SVG) |
| **Rename Tab** | `TabButton.jsx` L68 | `✏️` Emoji | Inconsistent with SVG pencil | `Pencil` (12px SVG) |
| **Delete Tab** | `TabButton.jsx` L103| `✕` Text | Baseline alignment drift | `X` (12px SVG) |

### 3. Left Library & Settings Sidebar ([`LeftSidebar.jsx`](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/sidebar/LeftSidebar.jsx))
| Control | Line | Current Icon | Problem | Proposed Modern Icon |
| :--- | :--- | :--- | :--- | :--- |
| **Set Background** | L328 | Mountain + Circle SVG | **Malformed SVG**: lines poke outside circle | `Image` (clean framed landscape SVG) |
| **Hide / Restore** | L339, 1171 | EyeOff / Eye SVG | Good, standardize in shared module | `EyeOff` / `Eye` (14px SVG) |
| **Rename Asset/Folder**| L309, 503, 1157| Pencil SVG | Good, standardize in shared module | `Pencil` (12px–14px SVG) |
| **Delete Asset/Folder**| L357, 522, 1190| Trash SVG | Good, standardize in shared module | `Trash2` (14px SVG) |
| **Folder Chevron** | L441 | `▶` / `▼` text | Uneven glyph sizing | `ChevronRight` / `ChevronDown` (12px SVG) |
| **Folder Icon** | L443 | `📁` Emoji | Cartoon yellow folder | `Folder` / `FolderOpen` (14px SVG) |
| **Add Subfolder** | L492 | `+` SVG | Standardize | `FolderPlus` (14px SVG) |
| **Shape Selector (5)**| L731–737 | `⬜` `⚪` `🔺` `⭐` `⬢` | **Mismatched colors** (white/red/yellow/mono) | `Square`, `Circle`, `Triangle`, `Star`, `Hexagon` SVGs |
| **Color Picker Badge**| L787, 845, 1614| `🎨` Emoji | Crammed into 24px circle | `Pipette` / `Palette` (12px SVG) |
| **Spawn Shape** | L904 | `➕` Emoji | Heavy dark emoji on sky-500 button | `Plus` (14px SVG) |
| **Library Search** | L975, 986 | `🔍` in placeholder, `×` | Disappears when typing | Positioned `Search` SVG + `X` SVG button |
| **New Folder Button**| L1079 | `📁+` text | Improvised emoji+plus string | `FolderPlus` (14px SVG) |
| **Root Dropzone** | L1102 | `📥` Emoji | Cartoon mailbox tray | `FolderUp` / `CornerLeftUp` (14px SVG) |
| **Back to Active** | L1244 | `←` text | Plain arrow character | `ArrowLeft` (12px SVG) |
| **Upload Error** | L1322 | `⚠️` Emoji | OS warning sticker | `AlertCircle` (14px SVG) |

### 4. Right Inspector & Layers Sidebar ([`RightSidebar.jsx`](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/sidebar/RightSidebar.jsx), [`InspectorWidget.jsx`](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/sidebar/InspectorWidget.jsx), [`TooltipInspector.jsx`](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/sidebar/TooltipInspector.jsx), [`ActiveUsersWidget.jsx`](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/sidebar/ActiveUsersWidget.jsx))
| Control | File & Line | Current Icon | Problem | Proposed Modern Icon |
| :--- | :--- | :--- | :--- | :--- |
| **Search & Clear** | `RightSidebar` L96, 103 | `🔍` & `✕` | Emoji search icon | `Search` & `X` SVGs |
| **Layer Drag Handle**| `RightSidebar` L226 | `⋮⋮` text | Font-dependent vertical alignment | `GripVertical` (14px 6-dot SVG) |
| **Bring to Front** | `RightSidebar` L250, `Inspector` L239 | `⏫` Emoji | Blue media fast-forward button; ignores disabled | `ChevronsUp` / `ArrowUpToLine` SVG |
| **Bring Forward** | `RightSidebar` L267, `Inspector` L247 | `▲` text | Mismatched with `⏫` | `ChevronUp` SVG |
| **Send Backward** | `RightSidebar` L284, `Inspector` L255 | `▼` text | Mismatched with `⏬` | `ChevronDown` SVG |
| **Send to Back** | `RightSidebar` L301, `Inspector` L263 | `⏬` Emoji | Blue media fast-backward button; ignores disabled| `ChevronsDown` / `ArrowDownToLine` SVG |
| **Locate on Canvas** | `RightSidebar` L317 | `👁️` Emoji | Looks like Hide/Show instead of Center/Locate | `LocateFixed` / `Crosshair` (14px SVG) |
| **Lock / Unlock** | `RightSidebar` L336–368 | `🔒` / `🔓` | Yellow padlock emojis | `Lock` / `Unlock` (13px–14px SVGs) |
| **Delete Element** | `RightSidebar` L403, `Inspector` L528 | `🗑️` Emoji | Inconsistent with SVG trash | `Trash2` (14px SVG) |
| **No Selection State**| `RightSidebar` L476 | `🔍` 3xl Emoji | Giant magnifying glass cartoon | `MousePointerClick` (28px SVG in badge) |
| **Shape `<select>`** | `Inspector` L289–293 | `⬜` `⚪` `🔺` `⭐` `⬢`| Mismatched emojis in `<option>` | Clean text labels (`Rectangle`, `Circle`, etc.) |
| **Tooltip Header** | `TooltipInspector` L127 | `💬` Emoji | Cartoon speech bubble | `MessageSquare` / `Sparkles` (14px SVG) |
| **Add / Remove Stat**| `TooltipInspector` L173–347| `＋` / `🗑️` | Fullwidth plus & trash emoji | `Plus` & `Trash2` SVGs |
| **Active Users Accordion**| `ActiveUsersWidget` L90, 97| `👥` & `➕`/`➖` | Heavy plus/minus emojis | `Users` & `ChevronDown`/`ChevronRight` SVGs |

### 5. Lobby, Dice Roller, Saves Modal & Canvas ([`Lobby.jsx`](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/lobby/Lobby.jsx), [`DiceRollerWidget.jsx`](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/sidebar/DiceRollerWidget.jsx), [`SavesModal.jsx`](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/saves/SavesModal.jsx), [`Canvas.jsx`](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/canvas/Canvas.jsx), [`DieIcon.jsx`](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/common/DieIcon.jsx))
| Control | File & Line | Current Icon | Problem | Proposed Modern Icon |
| :--- | :--- | :--- | :--- | :--- |
| **Invite Banner** | `Lobby.jsx` L219 | `✉️` Emoji | OS envelope sticker | `Mail` / `Sparkles` (16px SVG) |
| **Randomize Name/ID**| `Lobby.jsx` L267, 313| `🎲` Emoji | Cartoon die | `Dices` / `Shuffle` (14px–16px SVG) |
| **Refresh Rooms** | `Lobby.jsx` L387 | `🔄` Emoji | Blue emoji square | `RefreshCw` (14px SVG, spins when loading) |
| **Saved Filter/Badge**| `Lobby.jsx` L422, 490| `💾` Emoji | Floppy disk emoji | `Bookmark` / `Save` (12px–14px SVG) |
| **Loading Spinner** | `Lobby.jsx` L432 | `🌀` Emoji | Spinning cyclone emoji | `Loader2` (24px animated SVG spinner) |
| **Empty Rooms State**| `Lobby.jsx` L437 | `🔍` Emoji | Giant magnifying glass | `Search` (24px SVG in subtle circle) |
| **Dice Roller UI** | `DiceRollerWidget` | `🎲`, `✕`, `－`, `＋`| Fullwidth math chars & emojis | `Dices`, `X`, `Minus`, `Plus` SVGs |
| **Polyhedral Dice** | `DieIcon.jsx` L22–52| Outer polygon only | Looks like flat 2D shapes | Add subtle inner 3D facet lines per die type |
| **Saves Modal** | `SavesModal` L56, 66, 139| `💾`, `✕`, `🗑️` | Emojis in modal header & rows | `Save`, `X`, `Trash2` SVGs |
| **Zoom Controls** | `Canvas.jsx` L2107, 2134| `−` / `+` text | Font-dependent centering | `Minus` / `Plus` (14px SVGs) |

---

## 🏗️ Proposed Architecture & Implementation Plan

### Architectural Choice: Zero-Dependency Unified `<Icon />` System vs. `lucide-react`
Per [agent.md §Guardrails 4](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/agent.md#L163-L166), new runtime dependencies require explicit justification and approval:
- **Recommended — Option A (Zero-Dependency `client/src/components/common/Icon.jsx`)**:
  - Creates a single, lightweight, zero-dependency SVG icon component library using clean 24×24 `stroke="currentColor"` Lucide-style vector paths plus custom geometric shape & RPG dice icons.
  - **Pros**: Zero new npm dependencies, ~4 KB total footprint, 100% styling control (`size`, `strokeWidth`, `className`), instant compatibility with existing Vitest tests.
- **Alternative — Option B (`lucide-react` npm package)**:
  - Installs `lucide-react` in `client/package.json` and wraps/re-exports icons alongside custom geometric/RPG icons.

### Step-by-Step Implementation Phases

1. **Phase 1 — Create Unified Icon Module (`client/src/components/common/Icon.jsx`) & Enhance `DieIcon.jsx`**:
   - Implement `<Icon name="..." className="..." strokeWidth={2} />` (or named exports) with JSDoc contracts covering all ~35 vector icons (`mouse-pointer`, `hand`, `pencil`, `eraser`, `ruler`, `trash`, `sparkles`, `shapes`, `dices`, `sliders`, `maximize`, `minimize`, `undo`, `redo`, `save`, `log-out`, `users`, `link`, `check`, `x`, `plus`, `minus`, `search`, `folder`, `folder-open`, `folder-plus`, `folder-up`, `image`, `eye`, `eye-off`, `pipette`, `chevron-up`, `chevron-down`, `chevron-right`, `chevrons-up`, `chevrons-down`, `locate`, `lock`, `unlock`, `grip-vertical`, `message-square`, `refresh`, `loader`, `mail`, `alert-circle`, `arrow-left`, and geometric shapes `rect`, `circle`, `triangle`, `star`, `hexagon`).
   - Enhance [`DieIcon.jsx`](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/components/common/DieIcon.jsx) with subtle inner facet lines (`strokeOpacity="0.25"`) so d4, d6, d8, d10, d12, d20, and d100 look like authentic polyhedral dice.
   - Document `Icon.jsx` in [STRUCTURE.md](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/STRUCTURE.md).

2. **Phase 2 — Overhaul Primary Toolbars (`CanvasDock.jsx`, `Header.jsx`, `TabButton.jsx`, `Canvas.jsx`)**:
   - Replace the broken Eraser (`XCircle`), Ruler (`< >`), Select (`cursor-arrow-rays`), and Clear Drawings icons in `CanvasDock.jsx`.
   - Replace `🎨`, `🎲`, `⚙️` in `CanvasDock.jsx` with vector `shapes`, `dices`, and `sliders` icons that inherit `currentColor`.
   - Replace all emojis in `Header.jsx` (`🔗`, `✓`, `↩️`, `↪️`, `💾`, `🚪`, `👥`, `✏️`) and `TabButton.jsx` (`✏️`, `✕`) with crisp vector SVGs.
   - Replace zoom `+`/`−` text characters in `Canvas.jsx` with centered `plus`/`minus` SVGs.

3. **Phase 3 — Overhaul Left & Right Sidebars (`LeftSidebar.jsx`, `RightSidebar.jsx`, `InspectorWidget.jsx`, `TooltipInspector.jsx`, `ActiveUsersWidget.jsx`)**:
   - Fix the malformed Set Background SVG in `LeftSidebar.jsx`.
   - Replace the 5 mismatched shape emojis (`⬜`, `⚪`, `🔺`, `⭐`, `⬢`) with uniform vector shape icons in `LeftSidebar.jsx` and clean text labels in `InspectorWidget.jsx`'s `<select>`.
   - Replace `⏫`, `▲`, `▼`, `⏬`, `👁️`, `🔒`, `🔓`, `🗑️`, `⋮⋮`, `🔍`, `✕` in `RightSidebar.jsx` and `InspectorWidget.jsx` with vector icons that properly respect disabled states.
   - Replace `📁`, `📁+`, `📥`, `🎨`, `➕`, `⚠️` in `LeftSidebar.jsx` and emojis in `TooltipInspector.jsx` & `ActiveUsersWidget.jsx`.

4. **Phase 4 — Overhaul Modals, Widgets & Lobby (`Lobby.jsx`, `DiceRollerWidget.jsx`, `SavesModal.jsx`)**:
   - Replace `🌀` spinner, `🔄` refresh, `🎲` randomizers, `✉️` invite, `💾` saved badges, and `🔍` empty state in `Lobby.jsx`.
   - Replace emojis and fullwidth math glyphs in `DiceRollerWidget.jsx` and `SavesModal.jsx`.

5. **Phase 5 — Automated Verification & Documentation**:
   - Add unit test coverage for `Icon.jsx` and verify `InspectorWidget.test.jsx` and all existing test suites pass.
   - Run full verification loop (`npm --prefix client run lint`, `npm --prefix client run test -- --coverage --run`, `npm --prefix client run build`, `node --check server/server.js`).
   - Update `STRUCTURE.md`, `task.md`, and `walkthrough.md`, then commit and push.
