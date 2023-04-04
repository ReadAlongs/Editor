/**
 *  @since 4.0.0 This class has been split
 *
 * @typedef {Object} RegionsPluginParams
 * @property {?boolean} contentEditable=false Allow/disallow editing content of the region
 * @property {?boolean} removeButton=false adds remove region button
 * @property {?RegionParams[]} regions Regions that should be added upon
 * initialisation
 * @property {number} slop=2 The sensitivity of the mouse dragging
 * @property {?boolean} deferInit Set to true to manually call
 * @property {function} formatTimeCallback Allows custom formating for region tooltip.
 * @property {?number} edgeScrollWidth='5% from container edges' Optional width for edgeScroll to start
 */

/**
 * @typedef {Object} RegionParams
 * @desc The parameters used to describe a region.
 * @example wavesurfer.addRegion(regionParams);
 * @property {string} id=→random The id of the region
 * @property {number} start=0 The start position of the region (in seconds).
 * @property {number} end=0 The end position of the region (in seconds).
 * @property {?boolean} loop Whether to loop the region when played back.
 * @property {boolean} drag=true Allow/disallow dragging the region.
 * @property {boolean} resize=true Allow/disallow resizing the region.
 * @property {string} [color='rgba(0, 0, 0, 0.1)'] HTML color code.
 * @property {?number} channelIdx Select channel to draw the region on (if there are multiple channel waveforms).
 * @property {?object} handleStyle A set of CSS properties used to style the left and right handle.
 * @property {?boolean} preventContextMenu=false Determines whether the context menu is prevented from being opened.
 * @property {boolean} showTooltip=true Enable/disable tooltip displaying start and end times when hovering over region.
 */

import { Region } from "./region.js";

/**
 * Regions are visual overlays on waveform that can be used to play and loop
 * portions of audio. Regions can be dragged and resized.
 *
 * Visual customization is possible via CSS (using the selectors
 * `.wavesurfer-region` and `.wavesurfer-handle`).
 *
 * @implements {PluginClass}
 * @extends {Observer}
 *
 * @example
 * // es6
 * import RegionsPlugin from 'wavesurfer.regions.js';
 *
 * // commonjs
 * var RegionsPlugin = require('wavesurfer.regions.js');
 *
 * // if you are using <script> tags
 * var RegionsPlugin = window.WaveSurfer.regions;
 *
 * // ... initialising wavesurfer with the plugin
 * var wavesurfer = WaveSurfer.create({
 *   // wavesurfer options ...
 *   plugins: [
 *     RegionsPlugin.create({
 *       // plugin options ...
 *     })
 *   ]
 * });
 */
export default class RegionsPlugin {
    /**
     * Regions plugin definition factory
     *
     * This function must be used to create a plugin definition which can be
     * used by wavesurfer to correctly instantiate the plugin.
     *
     * @param {RegionsPluginParams} params parameters use to initialise the plugin
     * @return {PluginDefinition} an object representing the plugin
     */
    static create(params) {
        return {
            name: "regions",
            deferInit: params && params.deferInit ? params.deferInit : false,
            params: params,
            staticProps: {
                addRegion(options) {
                    if (!this.initialisedPluginList.regions) {
                        this.initPlugin("regions");
                    }
                    return this.regions.add(options);
                },

                clearRegions() {
                    this.regions && this.regions.clear();
                },
            },
            instance: RegionsPlugin,
        };
    }

    constructor(params, ws) {
        this.params = params;
        this.wavesurfer = ws;
        this.util = ws.util;
        this.regionsMinLength = params.regionsMinLength || null;

        // turn the plugin instance into an observer
        const observerPrototypeKeys = Object.getOwnPropertyNames(
            this.util.Observer.prototype
        );
        observerPrototypeKeys.forEach((key) => {
            Region.prototype[key] = this.util.Observer.prototype[key];
        });
        this.wavesurfer.Region = Region;

        // By default, scroll the container if the user drags a region
        // within 5% (based on its initial size) of its edge
        const scrollWidthProportion = 0.05;
        this._onBackendCreated = () => {
            this.wrapper = this.wavesurfer.drawer.wrapper;
            this.orientation = this.wavesurfer.drawer.orientation;
            this.defaultEdgeScrollWidth =
                this.wrapper.clientWidth * scrollWidthProportion;
            if (this.params.regions) {
                this.params.regions.forEach((region) => {
                    this.add(region);
                });
            }
        };

        // Id-based hash of regions
        this.list = {};
        this._onReady = () => {
            this.wrapper = this.wavesurfer.drawer.wrapper;
            this.vertical = this.wavesurfer.drawer.params.vertical;
            Object.keys(this.list).forEach((id) => {
                this.list[id].updateRender();
            });
        };
    }

    init() {
        // Check if ws is ready
        if (this.wavesurfer.isReady) {
            this._onBackendCreated();
            this._onReady();
        } else {
            this.wavesurfer.once("ready", this._onReady);
            this.wavesurfer.once("backend-created", this._onBackendCreated);
        }
    }

    destroy() {
        this.wavesurfer.un("ready", this._onReady);
        this.wavesurfer.un("backend-created", this._onBackendCreated);
        // Disabling `region-removed' because destroying the plugin calls
        // the Region.remove() method that is also used to remove regions based
        // on user input. This can cause confusion since teardown is not a
        // user event, but would emit `region-removed` as if it was.
        this.wavesurfer.setDisabledEventEmissions(["region-removed"]);
        this.clear();
    }

    /**
     * Add a region
     *
     * @param {object} params Region parameters
     * @return {Region} The created region
     */
    add(params) {
        params = {
            edgeScrollWidth:
                this.params.edgeScrollWidth || this.defaultEdgeScrollWidth,
            contentEditable: this.params.contentEditable,
            removeButton: this.params.removeButton,
            ...params,
        };

        // Take formatTimeCallback from plugin params if not already set
        if (!params.formatTimeCallback && this.params.formatTimeCallback) {
            params = {
                ...params,
                formatTimeCallback: this.params.formatTimeCallback,
            };
        }

        if (!params.minLength && this.regionsMinLength) {
            params = { ...params, minLength: this.regionsMinLength };
        }

        const region = new this.wavesurfer.Region(
            params,
            this.util,
            this.wavesurfer
        );

        this.list[region.id] = region;

        region.on("remove", () => {
            delete this.list[region.id];
        });

        return region;
    }

    /**
     * Remove all regions
     */
    clear() {
        Object.keys(this.list).forEach((id) => {
            this.list[id].remove();
        });
    }

    /**
     * Get current region
     *
     * The smallest region that contains the current time. If several such
     * regions exist, take the first. Return `null` if none exist.
     *
     * @returns {Region} The current region
     */
    getCurrentRegion() {
        const time = this.wavesurfer.getCurrentTime();
        let min = null;
        Object.keys(this.list).forEach((id) => {
            const cur = this.list[id];
            if (cur.start <= time && cur.end >= time) {
                if (!min || cur.end - cur.start < min.end - min.start) {
                    min = cur;
                }
            }
        });

        return min;
    }
}
