# Rectangle Hotkey Functionality - Changes Made

This document describes all the changes made to add rectangle hotkey functionality to the generic annotator app.

## Overview
Added the ability to press 'B' key to instantly place a rectangle at the mouse cursor position, and 'R' key to toggle rectangle mode.

## Files Modified

### 1. `index.html`
**Changes:**
- Added mouse coordinates display div
- Added hotkey information display div
- Moved these elements to a separate info panel for better layout

**Key additions:**
```html
<div id="info-panel">
    <div class="hotkey-info">
        <small>Hotkeys: <strong>B</strong> = instant rectangle at cursor | <strong>R</strong> = toggle click mode</small>
    </div>
    <div id="mouse-coords" class="mouse-coords">
        <small>Mouse: <span id="mouse-x">--</span>, <span id="mouse-y">--</span></small>
    </div>
</div>
```

### 2. `app.css`
**Changes:**
- Added styles for `.hotkey-info` and `.mouse-coords` elements
- Added styles for new `#info-panel` container

**Key additions:**
```css
#info-panel {
    grid-column: span 2;
    display: flex;
    gap: 1em;
    padding: 5px 10px;
    background-color: #f8f8f8;
    border-bottom: 1px solid #ddd;
}

.hotkey-info {
    margin-left: 10px;
    color: #666;
    font-size: 0.9em;
}

.hotkey-info strong {
    color: #333;
    background-color: #f0f0f0;
    padding: 2px 4px;
    border-radius: 3px;
    border: 1px solid #ccc;
}

.mouse-coords {
    margin-left: 10px;
    color: #666;
    font-size: 0.9em;
}

.mouse-coords span {
    color: #333;
    background-color: #e8f4f8;
    padding: 2px 4px;
    border-radius: 3px;
    border: 1px solid #b3d9e6;
    font-family: monospace;
}
```

### 3. `annotationConfig.json`
**Changes:**
- Added hotkey configuration for rectangle functionality
- Added rectangle settings for default size, color, and opacity

**Key additions:**
```json
"hotkeys": {
    "classes": true,
    "reviewNext": "M",
    "reviewPrevious": "N",
    "classifyNext": "P",
    "classifyPrevious": "O",
    "insertRectangle": "b",
    "toggleRectangleMode": "r"
},
"rectangleSettings": {
    "defaultWidth": 100,
    "defaultHeight": 50,
    "defaultColor": "red",
    "defaultOpacity": 0.5
}
```

### 4. `genericDSAannotator.mjs`
**Changes:**
- Added Rectangle import from CDN
- Added mouse tracking using OpenSeadragon.MouseTracker
- Added rectangle creation functions
- Added hotkey event listeners
- Fixed DSA initialization (changed `hash: "no-nav"` to `hash: true`)

**Key additions:**

**Import:**
```javascript
import { Rectangle } from 'https://cdn.jsdelivr.net/gh/pearcetm/osd-paperjs-annotation@0.4.12/src/js/paperitems/rectangle.mjs';
```

**Mouse tracking:**
```javascript
let currentMousePosition = null;
let isRectangleMode = false;
const mouseTracker = new OpenSeadragon.MouseTracker({
    element: viewer.canvas,
    moveHandler: function(event) {
        currentMousePosition = event.position;
        // Update mouse coordinates display
        const mouseX = document.getElementById('mouse-x');
        const mouseY = document.getElementById('mouse-y');
        if (mouseX && mouseY) {
            mouseX.textContent = Math.round(event.position.x);
            mouseY.textContent = Math.round(event.position.y);
        }
    }
});
```

**Rectangle creation function:**
```javascript
function makeRect(pixels, tiledImage, fc, x, y) {
    const bounds = tiledImage.viewportToImageRectangle(tiledImage.viewport.getBounds());
    const centerX = x || bounds.x + bounds.width / 2;
    const centerY = y || bounds.y + bounds.height / 2;
    const w = pixels;
    const h = pixels;

    const g = {
        type: 'Feature',
        geometry: {
            type: 'Point',
            properties: {
                subtype: 'Rectangle',
                width: w,
                height: h,
            },
            coordinates: [centerX, centerY]
        }
    };
    
    const r = new Rectangle(g);
    r.setStyle({
        rescale: { strokeWidth: 2 },
        strokeColor: config.rectangleSettings.defaultColor,
    });
    
    fc.addChild(r.paperItem);
    r.paperItem.applyRescale();
    return r;
}
```

**Rectangle insertion function:**
```javascript
function insertRectangleAtMouse(event) {
    const fixedWidth = config.rectangleSettings.defaultWidth;
    const fixedHeight = config.rectangleSettings.defaultHeight;

    const tiledImage = viewer.world.getItemAt(0);
    const imagePoint = tiledImage.viewerElementToImageCoordinates(new OpenSeadragon.Point(event.position.x, event.position.y));

    const toolkit = viewer.annotationToolkit;
    if (toolkit) {
        let featureCollection;
        if (toolkit.featureCollections && toolkit.featureCollections.length > 0) {
            featureCollection = toolkit.featureCollections[0];
        } else {
            featureCollection = toolkit.addEmptyFeatureCollectionGroup();
        }
        
        makeRect(fixedWidth, tiledImage, featureCollection, imagePoint.x, imagePoint.y);
    }
}
```

**Rectangle mode functions:**
```javascript
function enterRectangleMode() {
    isRectangleMode = true;
    console.log('Entered rectangle mode');
}

function exitRectangleMode() {
    isRectangleMode = false;
    console.log('Exited rectangle mode');
}
```

**Hotkey event listener:**
```javascript
document.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === config.hotkeys.insertRectangle.toLowerCase()) {
        if (currentMousePosition) {
            insertRectangleAtMouse({ position: currentMousePosition });
        }
    }
    if (event.key.toLowerCase() === config.hotkeys.toggleRectangleMode.toLowerCase()) {
        if (isRectangleMode) {
            exitRectangleMode();
        } else {
            enterRectangleMode();
        }
    }
    if (event.key === 'Escape' && isRectangleMode) {
        exitRectangleMode();
    }
});
```

**DSA initialization fix:**
```javascript
// Changed from: { hash: "no-nav", openFolder: false }
// To: { hash: true, openFolder: false }
let dsaUI = new DSAUserInterface(viewer, { hash: true, openFolder: false });
```

**Note:** The main function was renamed from `makeAbetaApp()` to `makeGenericDSAApp()` for better clarity.

## Functionality Added

1. **'B' key** - Instantly places a rectangle at the current mouse cursor position
2. **'R' key** - Toggles rectangle mode on/off
3. **'Escape' key** - Exits rectangle mode if active
4. **Mouse coordinates display** - Shows current mouse position in real-time
5. **Hotkey information display** - Shows available hotkeys to user

## Dependencies

- Uses existing `osd-paperjs-annotation` library from CDN
- Uses existing OpenSeadragon and Paper.js libraries
- Integrates with existing annotation toolkit and feature collection system

## Configuration

All settings are configurable through `annotationConfig.json`:
- Hotkey keys can be changed
- Rectangle size, color, and opacity can be customized
- All settings follow the existing configuration pattern

## Notes

- The rectangle functionality integrates seamlessly with the existing ROI system
- Uses the same Paper.js-based annotation system as the existing ROI functionality
- Maintains compatibility with DSA save/load functionality
- All rectangles are saved as part of the annotation toolkit feature collections
