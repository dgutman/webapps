import { RotationControlOverlay } from 'https://cdn.jsdelivr.net/gh/pearcetm/osd-paperjs-annotation@0.4.12/src/js/rotationcontrol.mjs';
import { BBox } from './apps/bbox.mjs';
import { DSAUserInterface } from './dsa/dsauserinterface.mjs';
import { Rectangle } from 'https://cdn.jsdelivr.net/gh/pearcetm/osd-paperjs-annotation@0.4.12/src/js/paperitems/rectangle.mjs';

export async function makeGenericDSAApp() {
    // Load configuration
    const response = await fetch('./annotationConfig.json');
    const config = await response.json();

    const ANNOTATION_TYPE = config.annotationType;
    const ANNOTATION_DESCRIPTION = config.annotationDescription;

    // don't navigate away accidentally
    window.addEventListener('beforeunload', function () {
        return 'Are you sure you want to leave?';
    });

    // create the viewer
    let viewer = window.viewer = OpenSeadragon({
        element: 'viewer',
        prefixUrl: "https://openseadragon.github.io/openseadragon/images/",
        minZoomImageRatio: 0.01,
        maxZoomPixelRatio: 16,
        visibilityRatio: 0,
        crossOriginPolicy: 'Anonymous',
        ajaxWithCredentials: false,
        showNavigator: true,
    });

    // suppress default handlers that openseadragon attaches
    viewer.addHandler('canvas-key', event => {
        if (['q', 'w', 'e', 'r', 'a', 's', 'd', 'f'].includes(event.originalEvent.key)) {
            event.preventDefaultAction = true;
        }
    });

    // DSA setup
    let dsaUI = new DSAUserInterface(viewer, { hash: "no-nav", openFolder: false });
    dsaUI.header.appendTo('.dsa-ui-container');

    // add rotation control
    const rotationControl = new RotationControlOverlay(viewer);
    rotationControl.origActivate = rotationControl.activate;
    rotationControl.disable = () => rotationControl.activate = () => { };
    rotationControl.enable = () => rotationControl.activate = rotationControl.origActivate;

    // Create mode toggle UI
    const modeToggleContainer = document.createElement('div');
    modeToggleContainer.className = 'mode-toggle';
    modeToggleContainer.style.margin = '10px';
    modeToggleContainer.style.display = 'flex';
    modeToggleContainer.style.gap = '10px';

    const roiButton = document.createElement('button');
    roiButton.textContent = 'ROI Mode';
    roiButton.className = 'mode-button active';

    const boundButton = document.createElement('button');
    boundButton.textContent = 'Bound Mode';
    boundButton.className = 'mode-button';

    // modeToggleContainer.appendChild(roiButton);
    // modeToggleContainer.appendChild(boundButton);
    document.querySelector('#annotation-controls').prepend(modeToggleContainer);

    const bboxApp = new BBox({
        viewer: viewer,
        container: '#annotation-controls',
        classes: config.classes,
        editROIs: true, // Start in ROI mode
        annotationType: ANNOTATION_TYPE,
        annotationDescription: ANNOTATION_DESCRIPTION,
        hotkeys: config.hotkeys
    });

    // Mode toggle functionality
    let currentMode = 'roi';

    function switchMode(mode) {
        if (mode === currentMode) return;

        currentMode = mode;
        bboxApp.editROIs = mode === 'roi';

        // Update button styles
        roiButton.classList.toggle('active', mode === 'roi');
        boundButton.classList.toggle('active', mode === 'bound');

        // Reset the app state
        bboxApp.reset();
    }

    roiButton.addEventListener('click', () => switchMode('roi'));
    boundButton.addEventListener('click', () => switchMode('bound'));

    // Zoom button functionality
    document.getElementById('zoom1x').addEventListener('click', () => {
        viewer.viewport.zoomTo(1);
    });
    document.getElementById('zoom5x').addEventListener('click', () => {
        viewer.viewport.zoomTo(5);
    });
    document.getElementById('zoom10x').addEventListener('click', () => {
        viewer.viewport.zoomTo(10);
    });
    document.getElementById('zoom20x').addEventListener('click', () => {
        viewer.viewport.zoomTo(20);
    });

    // Mouse tracking for hotkey functionality
    let currentMousePosition = null;
    let isRectangleMode = false;
    const mouseTracker = new OpenSeadragon.MouseTracker({
        element: viewer.canvas,
        moveHandler: function (event) {
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

    viewer.addHandler('open', () => {
        // Enable mouse tracking after viewer is loaded
        mouseTracker.setTracking(true);
        dsaUI.getAnnotations(viewer.world.getItemAt(0).source.item._id).then(d => {
            const existingAnnotations = d.filter(a => a.annotation.attributes?.type === ANNOTATION_TYPE);
            const promises = existingAnnotations.map(x => dsaUI.loadAnnotationAsGeoJSON(x._id));
            Promise.all(promises).then(annotations => {
                bboxApp.addFeatureCollections(annotations.flat());
                bboxApp.checkAppStatus(true);
            });
        });
    });

    bboxApp.enableSaveButton((geoJSON, toDelete) => {
        const itemID = viewer.world.getItemAt(0).source.item._id;
        const idsToDelete = toDelete.map(item => item.data.userdata?.dsa?.annotationId).filter(x => x);
        const promises = idsToDelete.map(id => dsaUI.deleteAnnotation(id));
        promises.push(dsaUI.saveAnnotationToolkitToDSA(itemID, viewer.annotationToolkit));
        bboxApp.clearROIsToDelete();
        return Promise.all(promises).then(() => {
            window.alert('Save was successful');
        }).catch(e => {
            console.error(e);
            window.alert('Error! There was a problem saving the annotation(s). Do you need to log in to the DSA? See console for details.');
        });
    });

    // Rectangle creation function
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

    // Function to insert rectangle at mouse position
    function insertRectangleAtMouse(event) {
        console.log('insertRectangleAtMouse called with event:', event);

        const fixedWidth = config.rectangleSettings.defaultWidth;
        const fixedHeight = config.rectangleSettings.defaultHeight;
        console.log('Rectangle size:', fixedWidth, 'x', fixedHeight);

        const tiledImage = viewer.world.getItemAt(0);
        const imagePoint = tiledImage.viewerElementToImageCoordinates(new OpenSeadragon.Point(event.position.x, event.position.y));
        console.log('Image point:', imagePoint);

        const toolkit = viewer.annotationToolkit;
        if (toolkit) {
            let featureCollection;
            if (toolkit.featureCollections && toolkit.featureCollections.length > 0) {
                featureCollection = toolkit.featureCollections[0];
            } else {
                featureCollection = toolkit.addEmptyFeatureCollectionGroup();
                console.log('Created new feature collection');
            }

            console.log('Creating rectangle using feature collection');

            makeRect(fixedWidth, tiledImage, featureCollection, imagePoint.x, imagePoint.y);
        } else {
            console.error('Annotation toolkit not available');
        }
    }

    // Rectangle mode functions
    function enterRectangleMode() {
        isRectangleMode = true;
        console.log('Entered rectangle mode');
    }

    function exitRectangleMode() {
        isRectangleMode = false;
        console.log('Exited rectangle mode');
    }

    // Hotkey event listener
    document.addEventListener('keydown', (event) => {
        console.log('Key pressed:', event.key);

        if (event.key.toLowerCase() === config.hotkeys.insertRectangle.toLowerCase()) {
            console.log('B key pressed, current mouse position:', currentMousePosition);
            if (currentMousePosition) {
                insertRectangleAtMouse({ position: currentMousePosition });
            } else {
                console.log('No mouse position available');
            }
        }
        if (event.key.toLowerCase() === config.hotkeys.toggleRectangleMode.toLowerCase()) {
            console.log('R key pressed, toggling rectangle mode');
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
}

