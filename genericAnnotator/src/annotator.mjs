import { RotationControlOverlay } from 'https://cdn.jsdelivr.net/gh/pearcetm/osd-paperjs-annotation@0.4.12/src/js/rotationcontrol.mjs';
import { BBox } from '../../apps/bbox.mjs';
import { DSAUserInterface } from '../../dsa/dsauserinterface.mjs';

export class GenericAnnotator {
    constructor(config) {
        this.config = config;
        this.viewer = null;
        this.bboxApp = null;
        this.dsaUI = null;
        this.rotationControl = null;
        this.initialize();
    }

    initialize() {
        this.setupViewer();
        this.setupEventHandlers();
        this.setupDSA();
        this.setupRotationControl();
        this.setupAnnotationApp();
        this.setupSaveFunctionality();
        this.loadAnnotations();
    }

    setupViewer() {
        this.viewer = window.viewer = OpenSeadragon({
            element: 'viewer',
            ...this.config.viewerOptions
        });
    }

    setupEventHandlers() {
        // Prevent accidental navigation
        window.addEventListener('beforeunload', () => {
            return 'Are you sure you want to leave?';
        });

        // Suppress default OpenSeadragon handlers
        this.viewer.addHandler('canvas-key', event => {
            const annotationKeys = this.config.annotationTypes.map(type => type.key);
            if (annotationKeys.includes(event.originalEvent.key)) {
                event.preventDefaultAction = true;
            }
        });
    }

    setupDSA() {
        this.dsaUI = new DSAUserInterface(this.viewer, {
            hash: "no-nav",
            openFolder: false
        });
        this.dsaUI.header.appendTo('.dsa-ui-container');
    }

    setupRotationControl() {
        this.rotationControl = new RotationControlOverlay(this.viewer);
        this.rotationControl.origActivate = this.rotationControl.activate;
        this.rotationControl.disable = () => this.rotationControl.activate = () => { };
        this.rotationControl.enable = () => this.rotationControl.activate = this.rotationControl.origActivate;
    }

    setupAnnotationApp() {
        this.bboxApp = new BBox({
            viewer: this.viewer,
            container: '#annotation-controls',
            classes: this.config.annotationTypes,
            editROIs: true,
            annotationType: this.config.annotationType,
            annotationDescription: this.config.annotationDescription,
            hotkeys: this.config.hotkeys
        });
    }

    setupSaveFunctionality() {
        this.bboxApp.enableSaveButton((geoJSON, toDelete) => {
            const itemID = this.viewer.world.getItemAt(0).source.item._id;
            const idsToDelete = toDelete.map(item => item.data.userdata?.dsa?.annotationId).filter(x => x);
            const promises = idsToDelete.map(id => this.dsaUI.deleteAnnotation(id));
            promises.push(this.dsaUI.saveAnnotationToolkitToDSA(itemID, this.viewer.annotationToolkit));
            this.bboxApp.clearROIsToDelete();

            return Promise.all(promises)
                .then(() => window.alert('Save was successful'))
                .catch(e => {
                    console.error(e);
                    window.alert('Error! There was a problem saving the annotation(s). Do you need to log in to the DSA? See console for details.');
                });
        });
    }

    loadAnnotations() {
        this.viewer.addHandler('open', () => {
            this.dsaUI.getAnnotations(this.viewer.world.getItemAt(0).source.item._id)
                .then(d => {
                    const existingAnnotations = d.filter(a =>
                        a.annotation.attributes?.type === this.config.annotationType
                    );
                    const promises = existingAnnotations.map(x =>
                        this.dsaUI.loadAnnotationAsGeoJSON(x._id)
                    );
                    Promise.all(promises).then(annotations => {
                        this.bboxApp.addFeatureCollections(annotations.flat());
                        this.bboxApp.checkAppStatus(true);
                    });
                });
        });
    }
} 