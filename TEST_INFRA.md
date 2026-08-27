# E2E Test Infra: Arkanoid Web Application

## Test Philosophy
- Opaque-box, requirement-driven testing directly derived from `ORIGINAL_REQUEST.md`.
- Dual-layer validation: Vitest fast unit/math/component tests + Playwright/Headless simulation E2E tests.
- Zero reliance on internal implementation quirks; deterministic `window.__ARKANOID_TEST_API__` bridge allows testing complex scenarios (multi-ball splits, laser shooting, shield bounces, level transitions).

---

## Feature Inventory
| # | Feature | Source | Tier 1 | Tier 2 | Tier 3 |
|---|---------|--------|:------:|:------:|:------:|
| 1 | 60 FPS Canvas Game Loop & Fixed Timestep | R1 | 5 | 5 | ✓ |
| 2 | Paddle Movement (Keyboard, Mouse, Touch) | R1 | 5 | 5 | ✓ |
| 3 | Continuous 2D Ball Physics & Boundary Collision | R1 | 5 | 5 | ✓ |
| 4 | Dynamic Angle Paddle Reflection | R1 | 5 | 5 | ✓ |
| 5 | Multi-Tier Bricks (Standard, Armored, Silver, TNT) | R1 | 5 | 5 | ✓ |
| 6 | Game State (Lives, Combo Multiplier, Scores) | R1 | 5 | 5 | ✓ |
| 7 | Multi-Ball Power-up | R2 | 5 | 5 | ✓ |
| 8 | Laser Paddle & Projectiles | R2 | 5 | 5 | ✓ |
| 9 | Extended & Shrink Paddle Modifiers | R2 | 5 | 5 | ✓ |
| 10 | Slow Ball & Fast Ball Modifiers | R2 | 5 | 5 | ✓ |
| 11 | Sticky / Catch Paddle Mechanic | R2 | 5 | 5 | ✓ |
| 12 | Shield / Floor Safety Barrier | R2 | 5 | 5 | ✓ |
| 13 | Particle Explosions & Screen Shake FX | R3 | 5 | 5 | ✓ |
| 14 | Web Audio API Synth Sound Effects | R3 | 5 | 5 | ✓ |
| 15 | 6 Progressive Level Layouts & Progression | R3 | 5 | 5 | ✓ |
| 16 | LocalStorage High Scores Persistence | R1 | 5 | 5 | ✓ |

---

## Test Architecture
- **Unit Test Runner**: `npx vitest run` with `jsdom` and `@testing-library/react`.
- **E2E Test Runner**: `npx vitest run tests/e2e/` (Headless GameEngine integration harness) and Playwright.
- **Test API Bridge**: `window.__ARKANOID_TEST_API__` exposed for fast simulation of powerups, hits, levels, and lifecycle events.

---

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Full Level 1 Clean Run | Paddle move, standard brick clearing, combo scoring, stage clear modal | Medium |
| 2 | Armored & Explosive Cascade | Armored brick crack stages, TNT chain reaction destroying adjacent bricks | High |
| 3 | Multi-Ball & Laser Mayhem | Multi-ball split into 3, laser shooting destroying bricks, concurrent collisions | High |
| 4 | Sticky Paddle Catch & Precision Aim | Sticky catch, angle re-aiming to narrow silver brick corridor | Medium |
| 5 | Shield Barrier Life Save & High Score | Ball drops into shield barrier, bounce recovery, final game over with local high score save | High |
| 6 | 6-Level Full Campaign Playthrough | Progressive level loading, difficulty curve, victory screen | Very High |

---

## Coverage Thresholds
- **Tier 1 (Feature Coverage)**: $\ge 5$ test cases per feature (80+ unit tests).
- **Tier 2 (Boundary & Corner Cases)**: $\ge 5$ tests per edge case (canvas boundary clamping, rapid multi-ball collisions, max particle limits, minimum vertical velocity).
- **Tier 3 (Cross-Feature Combinations)**: Pairwise tests (e.g. Laser + Multi-Ball, Sticky + Extended, Shield + Slow Ball).
- **Tier 4 (Real-World Scenarios)**: 6 full application-level playthrough scenarios.
