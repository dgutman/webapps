export const ANNOTATION_TYPE = 'A-beta bounding boxes';
export const ANNOTATION_DESCRIPTION = 'Created by the A-Beta Bounding Box App';

export const CLASSES = [
    { name: 'Diffuse', color: 'red', strokeWidth: 1, key: 'D' },
    { name: 'Cored', color: 'blue', strokeWidth: 1, key: 'F' },
    { name: 'Dyshoric', color: 'green', strokeWidth: 1, key: 'G' },
    { name: 'CAA', color: 'magenta', strokeWidth: 1, key: 'H' },
];

export const HOTKEYS = {
    classes: true,
    reviewNext: 'M',
    reviewPrevious: 'N',
    classifyNext: 'P',
    classifyPrevious: 'O'
};

// New configuration option to control ROI creation
export const ALLOW_ROI_CREATION = true;

// New configuration option to allow toggling between ROI creation and annotation drawing
export const ENABLE_MODE_TOGGLE = true; 