import { RotationControlOverlay } from 'https://cdn.jsdelivr.net/gh/pearcetm/osd-paperjs-annotation@0.4.12/src/js/rotationcontrol.mjs';
import { BBox } from './apps/bbox.mjs';
import { DSAUserInterface } from './dsa/dsauserinterface.mjs';
import { Rectangle } from 'https://cdn.jsdelivr.net/gh/pearcetm/osd-paperjs-annotation@0.4.12/src/js/paperitems/rectangle.mjs';

export class GenericAnnotator {
    constructor(config) {
        this.config = config;
        this.viewer = null;
        this.bboxApp = null;
        this.dsaUI = null;
        this.rotationControl = null;

        // Auth store for centralized authentication state
        this.authStore = {
            isLoggedIn: false,
            token: null,
            user: null,
            dsaAPI: null,
            setAuth: function (token, user, api) {
                this.isLoggedIn = true;
                this.token = token;
                this.user = user;
                this.dsaAPI = api;
                console.log('Auth store updated:', { user: user.name, hasToken: !!token });
            },
            clearAuth: function () {
                this.isLoggedIn = false;
                this.token = null;
                this.user = null;
                this.dsaAPI = null;
                console.log('Auth store cleared');
            }
        };

        this.initialize();
    }

    initialize() {
        this.setupViewer();
        this.setupEventHandlers();
        this.setupDSA();
        this.setupRotationControl();
        this.setupAnnotationApp();
        this.setupSaveFunctionality();
        this.setupRectangleFunctionality();
        this.configureUI();
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
        // Setup DSA with the working modal - we'll modify it later
        this.dsaUI = new DSAUserInterface(this.viewer, {
            hash: "no-nav",  // This was working before
            openFolder: false,  // This was working before
            server: this.config.dsaServer  // Pass the server URL directly
        });

        // Ensure the DSA UI is properly connected to our viewer
        this.dsaUI._viewer = this.viewer;

        // Connect DSA UI to our auth store
        this.dsaUI.authStore = this.authStore;

        // Create the DSA UI elements (this was in the working version)
        // For now, append to body to create the DSA UI elements
        this.dsaUI.header.appendTo('body');

        // Add event listener to see when items are selected
        if (this.dsaUI.events && typeof this.dsaUI.events.on === 'function') {
            this.dsaUI.events.on('itemSelected', (item) => {
                console.log('DSA item selected:', item);
            });
        } else {
            console.log('DSA UI events not available');
        }

        // Also listen for viewer events
        this.viewer.addHandler('open', (event) => {
            console.log('Viewer opened with image');
            console.log('Event:', event);
            console.log('Viewer world items:', this.viewer.world.getItemCount());
            if (this.viewer.world.getItemCount() > 0) {
                const item = this.viewer.world.getItemAt(0);
                console.log('First item:', item);
                console.log('Item source:', item.source);

                // Fit the image to the viewer
                setTimeout(() => {
                    this.viewer.viewport.fitBounds(item.getBounds());
                    console.log('Fitted image to viewer');
                }, 100);
            }
        });

        this.viewer.addHandler('tile-loaded', () => {
            console.log('Tile loaded');
        });

        this.viewer.addHandler('tile-load-failed', (event) => {
            console.log('Tile load failed:', event);
        });

        // Setup login/logout buttons in top toolbar
        const loginBtn = document.getElementById('login-btn');
        const logoutBtn = document.getElementById('logout-btn');
        const loginStatus = document.getElementById('login-status');

        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                this.showLoginDialog();
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.logoutFromDSA();
            });
        }

        // Setup browse button in sidebar
        const browseBtn = document.getElementById('browse-btn');
        if (browseBtn) {
            browseBtn.addEventListener('click', () => {
                this.openDSAFolderBrowser();
            });
        }

        // Setup sidebar toggle functionality
        this.setupSidebarToggle();

        // Setup hotkey help modal
        this.setupHotkeyHelp();

        // Update login status
        this.updateLoginStatus('Not logged in');

        // Try auto-login if credentials are stored
        this.tryAutoLogin();
    }


    showLoginDialog() {
        // Create a simple login dialog
        const dialog = $(`
            <div id="login-dialog" title="Login to DSA">
                <form>
                    <fieldset>
                        <label for="username">Username:</label>
                        <input type="text" name="username" id="username" class="text ui-widget-content ui-corner-all">
                        <label for="password">Password:</label>
                        <input type="password" name="password" id="password" class="text ui-widget-content ui-corner-all">
                        <label for="remember-me">
                            <input type="checkbox" id="remember-me" name="remember-me"> Remember me
                        </label>
                    </fieldset>
                </form>
            </div>
        `);

        // Remove any existing dialog
        $('#login-dialog').remove();

        // Pre-fill with saved credentials
        const savedUsername = localStorage.getItem('dsa-username');
        const savedPassword = localStorage.getItem('dsa-password');
        if (savedUsername) {
            dialog.find('#username').val(savedUsername);
        }
        if (savedPassword) {
            dialog.find('#password').val(savedPassword);
            dialog.find('#remember-me').prop('checked', true);
        }

        // Add to body and show
        dialog.appendTo('body').dialog({
            modal: true,
            width: 400,
            buttons: {
                "Login": () => {
                    const username = $('#username').val();
                    const password = $('#password').val();
                    const rememberMe = $('#remember-me').is(':checked');

                    // Save credentials if "Remember Me" is checked
                    if (rememberMe) {
                        localStorage.setItem('dsa-username', username);
                        localStorage.setItem('dsa-password', password);
                    } else {
                        localStorage.removeItem('dsa-username');
                        localStorage.removeItem('dsa-password');
                    }

                    this.loginToDSA(username, password);
                    dialog.dialog('close');
                },
                "Cancel": () => {
                    dialog.dialog('close');
                }
            }
        });
    }

    async loginToDSA(username, password, isAutoLogin = false) {
        try {
            const success = await this.dsaUI.connectToDSA(this.config.dsaServer, username, password);
            if (success) {
                console.log('DSA login successful');

                // Fetch user information
                const userInfo = await this.fetchUserInfo();

                // Ensure the DSA UI is properly connected
                this.dsaUI._viewer = this.viewer;

                // Update login status with user info
                this.updateLoginStatus('Connected', isAutoLogin, userInfo);

                // Automatically trigger the DSA connection logic (like the "Load DSA" button)
                await this.initializeDSAConnection();

                // Automatically open the image browser after successful login
                this.openDSAFolderBrowser();
            } else {
                this.updateLoginStatus('Login failed');
                console.log('DSA login failed');
            }
        } catch (error) {
            this.updateLoginStatus('Connection error');
            console.error('DSA login error:', error);
        }
    }

    async initializeDSAConnection() {
        try {
            console.log('Initializing DSA connection...');

            // This mimics what the "Load DSA" button does
            if (this.dsaUI && this.dsaUI.API) {
                // Test the connection by fetching user info
                const userResponse = await this.dsaUI.API.get('/user/me');
                console.log('DSA connection verified:', userResponse.data);

                // The DSA UI should now be fully initialized and ready
                return true;
            }
        } catch (error) {
            console.error('Error initializing DSA connection:', error);
            return false;
        }
    }

    checkExistingDSASession() {
        // Check for DSA-related cookies or localStorage items
        const cookies = document.cookie.split(';');
        const dsaCookies = cookies.filter(cookie =>
            cookie.includes('girder') ||
            cookie.includes('dsa') ||
            cookie.includes('token') ||
            cookie.includes('session')
        );

        // Check localStorage for DSA-related items
        const dsaLocalStorage = Object.keys(localStorage).filter(key =>
            key.includes('girder') ||
            key.includes('dsa') ||
            key.includes('token') ||
            key.includes('session')
        );

        console.log('DSA cookies found:', dsaCookies);
        console.log('DSA localStorage items found:', dsaLocalStorage);

        return dsaCookies.length > 0 || dsaLocalStorage.length > 0;
    }

    async fetchUserInfo() {
        try {
            console.log('Checking if DSA UI is available:', !!this.dsaUI);
            console.log('Checking if DSA API is available:', !!(this.dsaUI && this.dsaUI.API));

            if (this.dsaUI && this.dsaUI.API) {
                console.log('Attempting to fetch user info from /user/me');
                const response = await this.dsaUI.API.get('/user/me');
                console.log('User info response:', response.data);
                return response.data;
            } else {
                console.log('DSA UI or API not available');
                return null;
            }
        } catch (error) {
            console.error('Error fetching user info:', error);
            console.error('Error details:', error.response?.status, error.response?.data);
            return null;
        }
    }

    logoutFromDSA() {
        // Clear saved credentials
        localStorage.removeItem('dsa-username');
        localStorage.removeItem('dsa-password');

        // Reset DSA connection
        if (this.dsaUI) {
            this.dsaUI._currentItem = null;
            this.dsaUI._currentAnnotation = null;
        }

        // Clear the viewer
        this.viewer.close();

        // Hide the sidebar
        const sidebar = document.getElementById('image-sidebar');
        if (sidebar) {
            sidebar.classList.add('collapsed');
        }

        // Update login status
        this.updateLoginStatus('Not logged in');

        console.log('Logged out from DSA');
    }


    openDSAFolderBrowser() {
        console.log('Opening DSA folder browser...');

        const browserArea = document.getElementById('dsa-browser');
        if (browserArea && this.dsaUI) {
            // Clear the browser area
            browserArea.innerHTML = '';

            // Automatically connect to DSA and load content
            if (this.dsaUI.connectToDSA) {
                const success = this.dsaUI.connectToDSA(this.config.dsaServer);
                if (success) {
                    // Trigger the sidebar injection
                    this.dsaUI.injectIntoSidebar();
                    console.log('DSA connected and content loaded in sidebar');
                } else {
                    console.log('Failed to connect to DSA');
                    browserArea.innerHTML = '<div style="color: red;">Failed to connect to DSA</div>';
                }
            }
        } else {
            console.log('Could not access DSA UI or browser area');
            alert('DSA folder browser not available. Please check your connection.');
        }
    }



    async tryAutoLogin() {
        const savedUsername = localStorage.getItem('dsa-username');
        const savedPassword = localStorage.getItem('dsa-password');

        if (savedUsername && savedPassword) {
            console.log('Auto-login attempt with saved credentials');
            this.updateLoginStatus('Auto-logging in...');
            await this.loginToDSA(savedUsername, savedPassword, true);
        } else {
            // Check if we're already logged in (e.g., from a previous session)
            // Wait a bit for DSA UI to fully initialize
            setTimeout(async () => {
                try {
                    // First check if there are any DSA-related cookies or tokens
                    const hasDSASession = this.checkExistingDSASession();
                    console.log('Has existing DSA session:', hasDSASession);

                    if (hasDSASession) {
                        const userInfo = await this.fetchUserInfo();
                        if (userInfo) {
                            console.log('Already logged in, updating status');
                            this.updateLoginStatus('Connected', true, userInfo);
                            // Open the image browser if we're already logged in
                            this.openDSAFolderBrowser();
                        } else {
                            console.log('Session exists but user info fetch failed');
                        }
                    } else {
                        console.log('No existing DSA session found');
                    }
                } catch (error) {
                    console.log('Error checking login status:', error);
                }
            }, 1000); // Wait 1 second for DSA to initialize
        }
    }

    setupSidebarToggle() {
        const sidebar = document.getElementById('image-sidebar');
        const toggleBtn = document.getElementById('sidebar-toggle');
        const toggleMainBtn = document.getElementById('sidebar-toggle-main');

        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                sidebar.classList.add('collapsed');
            });
        }

        if (toggleMainBtn) {
            toggleMainBtn.addEventListener('click', () => {
                sidebar.classList.remove('collapsed');
            });
        }
    }

    setupHotkeyHelp() {
        const hotkeyHelpModal = document.getElementById('hotkey-help-modal');
        const hotkeyHelpClose = document.getElementById('hotkey-help-close');

        if (hotkeyHelpClose) {
            hotkeyHelpClose.addEventListener('click', () => {
                this.hideHotkeyHelp();
            });
        }

        // Close modal when clicking outside
        if (hotkeyHelpModal) {
            hotkeyHelpModal.addEventListener('click', (event) => {
                if (event.target === hotkeyHelpModal) {
                    this.hideHotkeyHelp();
                }
            });
        }
    }

    showHotkeyHelp() {
        const hotkeyHelpModal = document.getElementById('hotkey-help-modal');
        if (hotkeyHelpModal) {
            hotkeyHelpModal.style.display = 'flex';
        }
    }

    hideHotkeyHelp() {
        const hotkeyHelpModal = document.getElementById('hotkey-help-modal');
        if (hotkeyHelpModal) {
            hotkeyHelpModal.style.display = 'none';
        }
    }

    showImageSelectionDialog() {
        // Create image selection dialog
        const dialog = $(`
            <div id="image-dialog" title="Select Image">
                <div id="image-browser">
                    <div class="loading">Loading images...</div>
                </div>
            </div>
        `);

        // Remove any existing dialog
        $('#image-dialog').remove();

        // Add to body and show
        dialog.appendTo('body').dialog({
            modal: true,
            width: 600,
            height: 400,
            buttons: {
                "Cancel": () => {
                    dialog.dialog('close');
                }
            }
        });

        // Load images from DSA
        this.loadDSAImages(dialog);
    }

    async loadDSAImages(dialog) {
        try {
            // Use the DSA UI's built-in image loading functionality
            if (this.dsaUI && this.dsaUI.openFolder) {
                // Trigger the DSA folder browser
                this.dsaUI.openFolder();
            } else {
                // Fallback: show a simple message
                dialog.find('#image-browser').html(`
                    <div style="padding: 20px; text-align: center;">
                        <p>Image browser will be available after DSA connection is established.</p>
                        <p>You can also use the DSA interface directly.</p>
                    </div>
                `);
            }
        } catch (error) {
            console.error('Error loading DSA images:', error);
            dialog.find('#image-browser').html(`
                <div style="padding: 20px; text-align: center; color: red;">
                    <p>Error loading images: ${error.message}</p>
                </div>
            `);
        }
    }

    updateLoginStatus(status = 'Not connected', isAutoLogin = false, userInfo = null) {
        const loginStatus = document.getElementById('login-status');
        const loginBtn = document.getElementById('login-btn');
        const logoutBtn = document.getElementById('logout-btn');

        if (loginStatus) {
            if (status === 'Connected') {
                let statusText;
                if (isAutoLogin) {
                    statusText = 'Auto-logged in';
                } else {
                    statusText = 'Logged in';
                }

                // Add user info if available
                if (userInfo && userInfo.login) {
                    statusText += ` as: ${userInfo.login}`;
                } else if (userInfo && userInfo.firstName && userInfo.lastName) {
                    statusText += ` as: ${userInfo.firstName} ${userInfo.lastName}`;
                }

                loginStatus.textContent = statusText;
                loginStatus.style.color = '#27ae60'; // Green

                // Show logout button, hide login button
                if (loginBtn) loginBtn.style.display = 'none';
                if (logoutBtn) logoutBtn.style.display = 'block';
            } else if (status === 'Login failed') {
                loginStatus.textContent = 'Login failed';
                loginStatus.style.color = '#e74c3c'; // Red
                // Show login button, hide logout button
                if (loginBtn) loginBtn.style.display = 'block';
                if (logoutBtn) logoutBtn.style.display = 'none';
            } else if (status === 'Connection error') {
                loginStatus.textContent = 'Connection error';
                loginStatus.style.color = '#e74c3c'; // Red
                // Show login button, hide logout button
                if (loginBtn) loginBtn.style.display = 'block';
                if (logoutBtn) logoutBtn.style.display = 'none';
            } else if (status === 'Auto-logging in...') {
                loginStatus.textContent = 'Auto-logging in...';
                loginStatus.style.color = '#f39c12'; // Orange
                // Hide both buttons during auto-login
                if (loginBtn) loginBtn.style.display = 'none';
                if (logoutBtn) logoutBtn.style.display = 'none';
            } else {
                loginStatus.textContent = 'Not logged in';
                loginStatus.style.color = '#95a5a6'; // Gray
                // Show login button, hide logout button
                if (loginBtn) loginBtn.style.display = 'block';
                if (logoutBtn) logoutBtn.style.display = 'none';
            }
        }
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

    setupRectangleFunctionality() {
        // Mouse tracking for hotkey functionality
        this.currentMousePosition = null;
        this.isRectangleMode = false;

        const mouseTracker = new OpenSeadragon.MouseTracker({
            element: this.viewer.canvas,
            moveHandler: (event) => {
                this.currentMousePosition = event.position;
                // Update mouse coordinates display
                const mouseX = document.getElementById('mouse-x');
                const mouseY = document.getElementById('mouse-y');
                if (mouseX && mouseY) {
                    mouseX.textContent = Math.round(event.position.x);
                    mouseY.textContent = Math.round(event.position.y);
                }
            }
        });

        // Enable mouse tracking after viewer is loaded
        this.viewer.addHandler('open', () => {
            mouseTracker.setTracking(true);
        });

        // Zoom button functionality
        document.getElementById('zoom1x').addEventListener('click', () => {
            this.viewer.viewport.zoomTo(1);
        });
        document.getElementById('zoom5x').addEventListener('click', () => {
            this.viewer.viewport.zoomTo(5);
        });
        document.getElementById('zoom10x').addEventListener('click', () => {
            this.viewer.viewport.zoomTo(10);
        });
        document.getElementById('zoom20x').addEventListener('click', () => {
            this.viewer.viewport.zoomTo(20);
        });

        // Hotkey event listener
        document.addEventListener('keydown', (event) => {
            console.log('Key pressed:', event.key);

            try {
                if (this.config && this.config.hotkeys && this.config.hotkeys.insertRectangle &&
                    event.key && event.key.toLowerCase() === this.config.hotkeys.insertRectangle.toLowerCase()) {
                    console.log('B key pressed, current mouse position:', this.currentMousePosition);
                    if (this.currentMousePosition) {
                        this.insertRectangleAtMouse({ position: this.currentMousePosition });
                    } else {
                        console.log('No mouse position available');
                    }
                }
                if (this.config && this.config.hotkeys && this.config.hotkeys.toggleRectangleMode &&
                    event.key && event.key.toLowerCase() === this.config.hotkeys.toggleRectangleMode.toLowerCase()) {
                    console.log('R key pressed, toggling rectangle mode');
                    if (this.isRectangleMode) {
                        this.exitRectangleMode();
                    } else {
                        this.enterRectangleMode();
                    }
                }
                if (event.key === '?') {
                    this.showHotkeyHelp();
                }
                if (event.key === 'Escape') {
                    if (this.isRectangleMode) {
                        this.exitRectangleMode();
                    } else {
                        this.hideHotkeyHelp();
                    }
                }
            } catch (error) {
                console.error('Hotkey error:', error);
            }
        });
    }

    makeRect(pixels, tiledImage, fc, x, y) {
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
            strokeColor: this.config.rectangleSettings.defaultColor,
        });

        fc.addChild(r.paperItem);
        r.paperItem.applyRescale();
        return r;
    }

    insertRectangleAtMouse(event) {
        console.log('insertRectangleAtMouse called with event:', event);

        const fixedWidth = this.config.rectangleSettings.defaultWidth;
        const fixedHeight = this.config.rectangleSettings.defaultHeight;
        console.log('Rectangle size:', fixedWidth, 'x', fixedHeight);

        const tiledImage = this.viewer.world.getItemAt(0);
        const imagePoint = tiledImage.viewerElementToImageCoordinates(new OpenSeadragon.Point(event.position.x, event.position.y));
        console.log('Image point:', imagePoint);

        const toolkit = this.viewer.annotationToolkit;
        if (toolkit) {
            let featureCollection;
            if (toolkit.featureCollections && toolkit.featureCollections.length > 0) {
                featureCollection = toolkit.featureCollections[0];
            } else {
                featureCollection = toolkit.addEmptyFeatureCollectionGroup();
                console.log('Created new feature collection');
            }

            console.log('Creating rectangle using feature collection');

            this.makeRect(fixedWidth, tiledImage, featureCollection, imagePoint.x, imagePoint.y);
        } else {
            console.error('Annotation toolkit not available');
        }
    }

    enterRectangleMode() {
        this.isRectangleMode = true;
        console.log('Entered rectangle mode');
    }

    exitRectangleMode() {
        this.isRectangleMode = false;
        console.log('Exited rectangle mode');
    }

    configureUI() {
        // Always show DSA UI for now
        const dsaContainer = document.getElementById('dsa-ui-container');
        console.log('DSA container:', dsaContainer);
        if (dsaContainer) {
            dsaContainer.style.display = 'block';
            console.log('DSA container children:', dsaContainer.children.length);
        } else {
            console.log('DSA container not found!');
        }

        // Check annotation controls
        const annotationControlsEl = document.getElementById('annotation-controls');
        console.log('Annotation controls:', annotationControlsEl);
        if (annotationControlsEl) {
            console.log('Annotation controls children:', annotationControlsEl.children.length);
            annotationControlsEl.style.display = this.config.showAnnotationControls ? 'block' : 'none';
        }

        // Show/hide zoom controls
        const zoomControls = document.getElementById('magnification-controls');
        if (zoomControls) {
            zoomControls.style.display = this.config.showZoomControls ? 'flex' : 'none';
        }

        // Show/hide hotkey info
        const hotkeyInfo = document.getElementById('hotkey-info');
        if (hotkeyInfo) {
            hotkeyInfo.style.display = this.config.showHotkeyInfo ? 'block' : 'none';
        }

        // Show/hide mouse coordinates
        const mouseCoords = document.getElementById('mouse-coords');
        if (mouseCoords) {
            mouseCoords.style.display = this.config.showMouseCoords ? 'block' : 'none';
        }
    }
} 