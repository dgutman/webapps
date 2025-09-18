import { GenericAnnotator } from './annotator.mjs';

// Default configuration matching abeta app
const defaultConfig = {
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
        toggleRectangleMode: 't'  // Changed from 'r' since 'r' is used for rotation
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
    // UI Configuration
    showDSAUI: true,           // Show/hide DSA login interface
    showZoomControls: true,    // Show/hide zoom buttons
    showHotkeyInfo: true,      // Show/hide hotkey information
    showMouseCoords: true,     // Show/hide mouse coordinates
    showAnnotationControls: true, // Show/hide annotation controls
    // DSA Configuration
    dsaServer: 'http://multiplex.pathology.emory.edu:8080/'
};

// Initialize the application with custom configuration
export function initAnnotator(customConfig = {}) {
    const config = { ...defaultConfig, ...customConfig };
    const annotator = new GenericAnnotator(config);
    return annotator;
}

// For direct loading in index.html
initAnnotator(); 