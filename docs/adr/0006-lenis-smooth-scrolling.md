# ADR 0006: Lenis Smooth Scrolling for High-Performance Desktop UI

## Status
Accepted

## Context
The FRIDAY desktop operator features dense telemetry dashboards, chat streams, and technical grids. Native Windows webview scroll can feel abrupt and lacks fluid inertia. To achieve a state-of-the-art, 60fps kinetic feel matching high-end creative tools, momentum-based smooth scrolling is required.

## Decision
Adopt `lenis` (Studio Freight / Darkroom) for momentum-based virtual scrolling across the Console's scrollable containers and views.

## Consequences
- **Positive**: Buttery 60fps smooth momentum scrolling with configurable easing and duration. Respects `prefers-reduced-motion` per the Constitution.
- **Negative**: Adds ~12KB bundle size.
