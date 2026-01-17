# Responsive Design Quick Reference

## Key CSS Changes at a Glance

### Mobile-First Defaults (All Devices)
```css
main { padding: 12px; width: 100%; }
.callroom-lane { width: 100%; flex: 1 1 240px; }
.inputs-grid { grid-template-columns: 1fr; }
.tableau-rounds { grid-template-columns: 1fr; }
.settings-container { grid-template-columns: 1fr; }
#callroom-timer { font-size: 32px; }
```

---

## Responsive Breakpoints

### Desktop (1025px+)
- Main padding: 25px
- Nav button font: 15px
- Lanes: 280px width (4 columns visible)
- Timer: 48px font
- Settings grid: 2 columns
- Tableau grid: `repeat(auto-fit, minmax(350px, 1fr))`

### Tablet (768-1024px)
- Main padding: 18px
- Nav button font: 13px
- Lanes: 2-column (50% width each)
- Timer: 40px font
- Settings grid: 1 column
- Tableau grid: `repeat(auto-fit, minmax(300px, 1fr))`

### Mobile (480-767px)
- Main padding: 12px
- Nav button font: 12px
- Lanes: 100% width (full column)
- Timer: 32px font
- Settings grid: 1 column
- Controls: Full-width buttons, stacked vertically

### Very Small Mobile (<480px)
- Main padding: 10px
- Nav button font: 11px
- Lanes: 100% width, min-height 90px
- Timer: 28px font
- All buttons: Full-width, minimal padding

---

## Common Classes & Their Responsive Behavior

| Class | Mobile | Tablet | Desktop |
|-------|--------|--------|---------|
| `.callroom-lane` | 100% | calc(50%-6px) | 280px |
| `.callroom-controls` | Column stack | Column stack | Flex row |
| `.tableau-rounds` | 1-col grid | 1-col grid | Multi-col grid |
| `.settings-container` | 1-col grid | 1-col grid | 2-col grid |
| `.zeitplan-grid` | 1-col | 1-col | Multi-col |
| `#callroom-timer` | 32px | 40px | 48px |
| `nav button` | 12px | 13px | 15px |

---

## How to Test Responsiveness

### Option 1: Chrome DevTools
1. Open DevTools: `F12`
2. Toggle Device Toolbar: `Ctrl+Shift+M`
3. Select preset devices or custom dimensions
4. Test at: 320px, 375px, 480px, 768px, 1024px, 1440px

### Option 2: Manual Resize
1. Open app in browser
2. Press `F12` to open DevTools
3. Resize browser window gradually from small to large
4. Verify no horizontal scrolling at any size

### Option 3: Mobile Device
1. Deploy app to local server or PWA
2. Test on actual phone/tablet
3. Verify touch targets are tappable
4. Check portrait and landscape orientation

---

## Common Responsive Patterns Used

### 1. Fluid Width with Max-Width
```css
main {
  padding: 12px;
  width: 100%;
  margin: 0 auto;
}
/* Desktop override: max-width: 1400px; padding: 25px; */
```

### 2. Mobile-First Grid
```css
.grid {
  display: grid;
  grid-template-columns: 1fr;  /* Mobile default */
}
@media (min-width: 768px) {
  .grid { grid-template-columns: 1fr 1fr; }  /* Tablet */
}
@media (min-width: 1025px) {
  .grid { grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }  /* Desktop */
}
```

### 3. Stack on Mobile, Flex on Desktop
```css
.controls {
  display: flex;
  flex-direction: column;  /* Mobile: vertical stack */
}
@media (min-width: 1025px) {
  .controls { flex-direction: row; }  /* Desktop: horizontal */
}
```

### 4. Full-Width on Mobile, Fixed on Desktop
```css
.lane {
  width: 100%;  /* Mobile */
}
@media (min-width: 1025px) {
  .lane { width: 280px; }  /* Desktop */
}
```

---

## Font Size Scaling

Responsive font sizes for different screen sizes:

| Element | Mobile | Tablet | Desktop |
|---------|--------|--------|---------|
| h1 | 20px | 24px | 26px+ |
| h2 | 18px | 20px | 22px |
| h3 | 14px | 16px | 18px |
| nav button | 12px | 13px | 15px |
| p, default | 13px | 14px | 16px |
| Timer | 28px | 40px | 48px |
| Input | 14px | 14px | 16px |

---

## Padding & Margin Scaling

| Container | Mobile | Tablet | Desktop |
|-----------|--------|--------|---------|
| main | 12px | 18px | 25px |
| section | 10px | 12px | 15px+ |
| button | 6px 8px | 7px 10px | 10px 18px |
| gap (flex) | 8px | 12px | 15px+ |

---

## Debugging Responsive Issues

### Problem: Content overflows horizontally on mobile
**Solution**: 
- Check for `width: Xpx` - should use `%` or `max-width`
- Verify `overflow-x: auto` is on narrow containers
- Check for large images or tables without responsive styles

### Problem: Buttons too small to tap on mobile
**Solution**:
- Ensure buttons are `width: 100%` or `min-width: 44px`
- Check padding is adequate: `8px+` minimum
- Verify font size is readable: `12px+` minimum

### Problem: Text too large on desktop, too small on mobile
**Solution**:
- Use mobile-first sizing as default
- Add desktop overrides in media queries
- Reference the font scaling table above

### Problem: Grid doesn't change on smaller screens
**Solution**:
- Check media query breakpoints are correct
- Verify `grid-template-columns` is overridden in media query
- Ensure media query rule is more specific or comes later in CSS

---

## Browser Support

✅ **Full Support**
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

⚠️ **Partial Support**
- IE 11: Basic layout, no Grid support
- Safari 12-13: Limited Grid support
- Chrome 50-89: Full support with vendor prefixes

---

## Optimization Tips

1. **Mobile First**: Always start with mobile styles, then enhance
2. **Min-Width**: Use `@media (min-width: X)` for progressive enhancement
3. **Fluid Typography**: Consider using `clamp()` for smoother scaling
4. **Flexible Units**: Use `flex: 1 1 240px` instead of fixed widths
5. **Touch Targets**: Always 44px+ for mobile buttons
6. **Viewport Meta**: Already in HTML, ensures correct mobile scaling

---

## Current CSS File Structure

```
style.css (1438 lines total)

1. Global styles (body, html)
2. Navigation
3. Offline indicator
4. Main container & typography
5. Grid system (12-col)
6. Tableau inputs
7. Settings container
8. KO tree styling
9. Mobile defaults (old, some overlap)
10. Callroom styling
    - callroom-controls
    - callroom-row
    - callroom-lane (now responsive)
11. Overview styling
    - overview-controls
    - overview-callroom-row
    - overview-callroom-lane (now responsive)
12. Tableau display
    - tableau-rounds (now responsive grid)
    - tableau-match
    - tableau-player
13. Zeitplan (schedule)
    - zeitplan-grid (now responsive)
    - zeitplan-item
14. Missing fencers
    - missing-fencers-list
15. Log modal
    - log-modal-overlay
    - log-modal (responsive sizing)
16. ===== RESPONSIVE DESIGN SECTION =====
    - @media (min-width: 1025px) - DESKTOP
    - @media (min-width: 768px) and (max-width: 1024px) - TABLET
    - @media (max-width: 767px) - MOBILE
    - @media (max-width: 479px) - VERY SMALL MOBILE
```

---

## What to Do If Something Breaks

1. **Check CSS is valid**: Use browser DevTools → Elements → Computed
2. **Verify breakpoints**: Make sure your screen size matches media query
3. **Check media query order**: Later rules override earlier ones
4. **Use DevTools**: Right-click → Inspect → Check which styles apply
5. **Mobile-first approach**: Don't rely on max-width cascade

---

## Next Steps for Enhancement

Future responsive improvements:
- [ ] Add `container-queries` for component-level responsiveness
- [ ] Use `clamp()` for fluid typography: `font-size: clamp(12px, 2vw, 16px)`
- [ ] Add print media queries for printing schedules
- [ ] Optimize for landscape orientation on mobile
- [ ] Add dark mode media query: `@media (prefers-color-scheme: dark)`
- [ ] Add reduced motion media query for accessibility

