---
version: alpha
name: CAD-Workstation-design-system
description: "An authentic, utilitarian industrial workstation aesthetic for engineering, CFD, scientific tools, and developer workstations. Built on neutral slate/graphite dark surfaces (#121316, #18191d), hairline borders (#262830), and purposeful high-contrast accents (engineering blue #3b82f6, telemetry green #10b981, warning amber #f59e0b). Zero neon sci-fi glow, zero unnecessary glassmorphism blur. High visual density, tabular figures for all data, crisp direct-manipulation handles, and structured docked inspector panels."

colors:
  canvas: "#121316"
  surface-panel: "#18191d"
  surface-hover: "#1f2127"
  surface-input: "#101114"
  hairline: "#262830"
  hairline-medium: "#343844"
  hairline-focus: "#4f5569"
  
  ink: "#f3f4f6"
  ink-secondary: "#9ca3af"
  ink-muted: "#6b7280"
  
  primary: "#3b82f6"
  primary-hover: "#2563eb"
  primary-soft: "rgba(59, 130, 246, 0.12)"
  
  telemetry-green: "#10b981"
  telemetry-green-soft: "rgba(16, 185, 129, 0.12)"
  telemetry-amber: "#f59e0b"
  telemetry-amber-soft: "rgba(245, 158, 11, 0.12)"
  telemetry-red: "#ef4444"
  telemetry-red-soft: "rgba(239, 68, 68, 0.12)"

typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: 18px
    fontWeight: 600
    letterSpacing: -0.2px
  section-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: 11px
    fontWeight: 600
    textTransform: uppercase
    letterSpacing: 0.6px
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.4
  data-numeric:
    fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace"
    fontSize: 12px
    fontWeight: 600
    fontVariantNumeric: tabular-nums
  status-mono:
    fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace"
    fontSize: 11px
    fontWeight: 400

rounded:
  sm: 4px
  md: 6px
  lg: 8px
  pill: 9999px

spacing:
  xxs: 2px
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  xxl: 24px

components:
  top-toolbar:
    height: 48px
    backgroundColor: "{colors.surface-panel}"
    borderBottom: "1px solid {colors.hairline}"
  docked-inspector:
    width: 320px
    backgroundColor: "{colors.surface-panel}"
    borderLeft: "1px solid {colors.hairline}"
  bottom-status-strip:
    height: 26px
    backgroundColor: "{colors.surface-input}"
    borderTop: "1px solid {colors.hairline}"
  tab-button:
    padding: 4px 12px
    rounded: "{rounded.sm}"
  numeric-input:
    backgroundColor: "{colors.surface-input}"
    border: "1px solid {colors.hairline}"
    rounded: "{rounded.sm}"
---

# CAD Workstation Visual Language

## Core Tenets
1. **Utilitarian Elegance**: Form strictly follows engineering function. No decorative sci-fi tropes.
2. **Neutral Substrates**: The canvas and panels stay neutral gray/slate so that data, simulations, and visualizations stand out clearly.
3. **Tabular Numerics**: All numeric values must use monospaced fonts with tabular figures to prevent jitter during real-time telemetry streaming.
4. **Docked Inspectors**: Controls live in stable, organized sidebars rather than chaotic floating glass cards.
