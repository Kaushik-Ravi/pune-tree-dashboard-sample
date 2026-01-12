# 🧪 Quick Tour Testing Guide

## How to Test the Fixed Tour System

### 1. Reset Tour State
Open browser console and run:
```javascript
localStorage.removeItem('hasCompletedTour');
window.location.reload();
```

### 2. Start Development Server (if not running)
```bash
npm run dev
```

### 3. Open DevTools Console
Watch for these log messages:
- ✅ `Tour target found: "selector" (attempt X)`
- ⚠️ `Tour target "selector" not found in Xms. Retrying...`
- ❌ `Tour target "selector" not found after X attempts` (should be rare)

---

## ✅ Expected Tour Flow

### Desktop Tour Steps:
1. **Welcome** - Centered modal
2. **Open Dashboard** - Points at sidebar toggle (desktop)
   - *Watch: Sidebar should open smoothly*
3. **Dashboard Tabs** - Points at tab bar
   - *Verify: Tab 0 (City Overview) is active*
4. **Drawing Tools** - Points at polygon draw button
   - *Watch: Sidebar closes before tooltip appears*
5. **Know Your Neighbourhood** - Points at section in City Overview
   - *Watch: Sidebar opens, Tab 0 loads, THEN tooltip*
6. **Planting Advisor** - Points at Planting Advisor tab
   - *Watch: Tab switches to index 2*
7. **Map Layers** - Points at Map Layers tab
   - *Watch: Tab switches to index 3*
8. **3D Mode** - Points at 3D toggle
   - *Watch: Sidebar closes*
9. **Finish** - Centered modal

### Mobile Tour Steps:
Same as above but step 2 points at mobile sidebar toggle

---

## 🎯 What to Look For

### ✅ Good Signs:
- "Preparing next step..." appears briefly between steps
- Tooltips always point at visible elements
- Smooth transitions between sidebar states
- Console shows ✅ for all targets
- No "flashing" or repositioning of tooltips

### ⚠️ Warning Signs:
- Tooltip appears before target element
- Tooltip points at nothing
- Console shows retry messages frequently
- Tour hangs on a step

### ❌ Critical Issues:
- Tour crashes or stops progressing
- Multiple ❌ errors in console
- Tooltips never appear
- JavaScript errors thrown

---

## 🔍 Detailed Testing Scenarios

### Scenario 1: Normal Flow (Happy Path)
1. Clear tour state and reload
2. Wait for tour to start (1.5s delay)
3. Click "Next" through all steps
4. Verify each tooltip appears correctly positioned
5. Confirm tour completes and localStorage is set

**Expected Result:** Smooth progression, no errors

---

### Scenario 2: Fast Clicking
1. Start tour
2. Rapidly click "Next" 5-10 times
3. Watch for race conditions or double-advancement

**Expected Result:** Should handle gracefully, steps don't skip

---

### Scenario 3: Mobile Device
1. Open DevTools → Toggle Device Toolbar
2. Select "iPhone 12 Pro" or similar
3. Clear tour state and reload
4. Verify mobile-specific step appears (sidebar toggle)

**Expected Result:** Mobile flow works smoothly

---

### Scenario 4: Slow Network
1. Open DevTools → Network tab → Throttling → "Slow 3G"
2. Clear tour state and reload
3. Watch retry logic work

**Expected Result:** Retry messages in console, but tour completes

---

### Scenario 5: Skip/Close Tour
1. Start tour
2. Click "Skip Tour" or X button
3. Verify localStorage is set
4. Reload - tour should not restart

**Expected Result:** Tour completion saved

---

## 🐛 If You Find Issues

### Issue: Tooltip appears before target
**Check:** 
- `executePreStepActions` is called before `setTourStepIndex`
- `waitForSidebarTransition` timeout is long enough
- Target has correct `data-tour-id` attribute

**Fix:** Increase delays in `executePreStepActions`

---

### Issue: Target not found errors
**Check:**
- Element exists in DOM
- Element has `data-tour-id` attribute
- Element is not hidden (display: none)

**Fix:** 
- Add/fix `data-tour-id` attribute
- Increase timeout in `waitForTourTarget`

---

### Issue: Tour starts too early
**Check:** Tour start delay in App.tsx

**Fix:**
```typescript
setTimeout(() => {
  setRunTour(true);
}, 2500); // Increase from 1500 to 2500
```

---

### Issue: Sidebar doesn't open/close properly
**Check:** 
- `waitForSidebarTransition` promise resolution
- Sidebar CSS transition duration

**Fix:** Increase fallback timeout:
```typescript
setTimeout(resolve, 800); // Increase from 500
```

---

## 📊 Success Criteria

Tour system is working correctly if:
- ✅ All 9 steps complete without errors
- ✅ Tooltips always point at visible elements
- ✅ "Preparing next step..." appears during transitions
- ✅ Console shows ✅ for all targets
- ✅ No double-advancement or skipped steps
- ✅ Mobile flow works identically to desktop
- ✅ Fast-clicking doesn't break tour
- ✅ Tour completion persists after reload

---

## 🚀 Performance Notes

### Timing Breakdown:
- Tour start delay: 1500ms
- Sidebar transition: ~300ms
- Tab content render: ~200ms
- Element detection: 100-8000ms (with retries)
- Total per step: ~500-2000ms

### Console Log Volume:
Expect 9-15 log messages total:
- 9 "✅ Tour target found" messages
- 0-3 "⚠️ Retrying" messages (acceptable)
- 0 "❌ Not found" errors (critical if present)

---

## 🎓 Tips for Effective Testing

1. **Always test with console open** - Logs tell the story
2. **Test on real mobile device** - Emulation isn't perfect
3. **Clear cache between tests** - Avoid stale state
4. **Test with slow network** - Reveals timing issues
5. **Try different browsers** - Chrome, Firefox, Safari
6. **Test at different zoom levels** - Affects positioning
7. **Test with different sidebar widths** - Responsive behavior

---

## ✨ Optional: Advanced Testing

### Test Error Recovery:
1. Manually remove `data-tour-id` from an element
2. Start tour and reach that step
3. Verify error dialog appears
4. Click "Skip Step" - should advance
5. Click "Retry" - should attempt again

### Test with DevTools:
1. Start tour
2. Open React DevTools
3. Watch state changes in App component
4. Verify `isPreparingStep`, `tourStepIndex`, `sidebarOpen` update correctly

---

**Happy Testing! 🎉**

If all tests pass, the tour system is ready for production deployment.
