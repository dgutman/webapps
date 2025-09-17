import { RotationControlOverlay } from 'https://cdn.jsdelivr.net/gh/pearcetm/osd-paperjs-annotation@0.4.12/src/js/rotationcontrol.mjs';
import { BBox } from '../apps/bbox.mjs';
import { DSAUserInterface } from '../dsa/dsauserinterface.mjs';
import { Rectangle } from 'https://cdn.jsdelivr.net/gh/pearcetm/osd-paperjs-annotation@0.4.12/src/js/paperitems/rectangle.mjs';

export async function makeAbetaApp() {
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

    viewer.addHandler('open', () => {
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
}

