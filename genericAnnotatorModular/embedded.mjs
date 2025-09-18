import { GenericAnnotator } from './annotator.mjs';

// Embedded configuration - minimal UI for programmatic use
const embeddedConfig = {
    annotationTypes: [
        { name: 'Diffuse', color: 'red', strokeWidth: 1, key: 'D' },
        { name: 'Cored', color: 'blue', strokeWidth: 1, key: 'F' },
        { name: 'Dyshoric', color: 'green', strokeWidth: 1, key: 'G' },
        { name: 'CAA', color: 'magenta', strokeWidth: 1, key: 'H' }
    ],
    hotkeys: {
        classes: true,
        reviewNext: 'M',
        reviewPrevious: 'N',
        classifyNext: 'P',
        classifyPrevious: 'O',
        insertRectangle: 'b',
        toggleRectangleMode: 'r'
    },
    rectangleSettings: {
        defaultWidth: 100,
        defaultHeight: 50,
        defaultColor: 'red',
        defaultOpacity: 0.5
    },
    viewerOptions: {
        prefixUrl: "https://openseadragon.github.io/openseadragon/images/",
        minZoomImageRatio: 0.01,
        maxZoomPixelRatio: 16,
        visibilityRatio: 0,
        crossOriginPolicy: 'Anonymous',
        ajaxWithCredentials: false,
        showNavigator: true
    },
    enableRotation: true,
    enableSave: true,
    enableNavigation: true,
    annotationType: 'A-beta bounding boxes',
    annotationDescription: 'Created by the A-Beta Bounding Box App',
    defaultMode: 'bound',
    // Embedded UI Configuration - minimal interface
    showDSAUI: false,           // Hide DSA login interface
    showZoomControls: true,     // Keep zoom buttons
    showHotkeyInfo: true,       // Keep hotkey information
    showMouseCoords: true,      // Keep mouse coordinates
    showAnnotationControls: true // Keep annotation controls
};

// Initialize the embedded annotator
const annotator = new GenericAnnotator(embeddedConfig);

// Export for external access if needed
window.annotator = annotator;
