# V4.3 design mapping

The supplied file is `design/reference/FlowPlan_Personal_V4_3_Analytics_Refined.html`. The task named `design/reference/flowplan-v4.3.html`; that shorter filename was not present. The supplied file is the authoritative reference and is retained unchanged.

## Preserved

- Pale gray canvas `#f7f8fa`, white surfaces, ink `#202738`, muted text `#798397`, thin borders `#e8eaf0`, indigo accent `#5363d7`, and pastel project colors, taken from the reference’s final compact-style overrides.
- Compact 194-pixel sidebar, 58-pixel utility header, 20–21-pixel page titles, approximately 12-pixel content, smaller metadata, modest corner radii, and subtle shadows.
- Profile at bottom-left immediately above Settings. No density controls, desktop sidebar collapse, theme controls, or team/account switching.
- Dashboard micro-stat strip, wide next-actions panel, smaller progress widgets, and project pulse cards.
- Four-stage board, compact cards, dark calendar surface, light schedule panels, quiet analytics card headers, slim stacked bars, pastel project series, and layered completion lines.
- Project overview, task list, notes, and isolated activity tabs.

## Intentional adaptations

- Starts empty instead of seeding sample user projects or analytics.
- Real progress widgets replace the prototype’s focus timer; workflow balance replaces focus-duration analytics. No focus data is invented.
- Recharts provides tooltips, responsive sizing, project visibility toggles, and keyboard chart access. A daily data table is available below cumulative analytics.
- The board becomes two columns on medium screens and one on very narrow screens, with status selects as a touch/keyboard alternative to dragging.
- On phones, calendar cells show dates and event indicators; tapping a date reveals full event details in the selected-day panel. Dates and task labels remain accessible without horizontal scrolling.
- Mobile navigation uses a menu overlay. All desktop navigation destinations remain accessible on mobile.
- Native modal dialogs provide focus containment and Escape support. Text is rendered by React, never interpolated as raw user HTML.
- Local system sans-serif fonts avoid external font requests. Inter is used if already installed; Segoe UI is the normal Windows fallback, as in the reference font stack.

Visual verification uses the approved reference and screenshots of the implemented production routes. Browser-test screenshots contain explicitly marked demonstration fixtures, not actual user progress.
