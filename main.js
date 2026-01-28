import * as Cesium from "cesium";
import mpegts from "mpegts.js";
import { Buffer } from "buffer";

// Polyfill Buffer for misb.js
window.Buffer = Buffer;

const viewer = new Cesium.Viewer("cesiumContainer", {
    timeline: false,
    animation: false,
    sceneModePicker: false,
    baseLayerPicker: false,
    geocoder: Cesium.IonGeocodeProviderType.GOOGLE,
    globe: false,
});

const { scene, camera } = viewer;

// Add Photorealistic 3D Tiles
try {
    const tileset = await Cesium.createGooglePhotorealistic3DTileset({
        onlyUsingWithGoogleGeocoder: true,
    });
    scene.primitives.add(tileset);
} catch (error) {
    console.log(`Error loading Photorealistic 3D Tiles tileset. ${error}`);
}

// Enable rendering the sky
scene.skyAtmosphere.show = true;

// MpegTS Player Integration
const fileInput = document.getElementById("fileInput");
const videoElement = document.getElementById("videoElement");

if (fileInput) {
    fileInput.addEventListener("change", function (event) {
        const file = event.target.files[0];
        if (!file) return;

        const fileURL = URL.createObjectURL(file);

        if (mpegts.getFeatureList().mseLivePlayback) {
            if (window.player) {
                window.player.pause();
                window.player.unload();
                window.player.detachMediaElement();
                window.player.destroy();
            }

            window.player = mpegts.createPlayer({
                type: "mse",
                isLive: false,
                url: fileURL,
            });

            window.player.attachMediaElement(videoElement);
            window.player.load();
            window.player.play();

            // Show video element for debugging
            videoElement.style.display = "block";

            window.player.on(mpegts.Events.SYNCHRONOUS_KLV_METADATA_ARRIVED, (data) =>
                handleMetadata("SYNC_KLV", data)
            );
            window.player.on(mpegts.Events.ASYNCHRONOUS_KLV_METADATA_ARRIVED, (data) =>
                handleMetadata("ASYNC_KLV", data)
            );
        } else {
            alert("Your browser does not support Media Source Extensions.");
        }
    });
}

function handleMetadata(eventType, data) {
    try {
        let validData = data;
        if (data.data && (data.data instanceof Uint8Array || data.data instanceof ArrayBuffer)) {
            validData = new Uint8Array(data.data);
        } else if (data instanceof Uint8Array) {
            validData = data;
        } else if (data instanceof ArrayBuffer) {
            validData = new Uint8Array(data);
        }

        const buf = Buffer.from(validData);

        // Assume MisbLibrary is available globally from the script tag
        if (typeof MisbLibrary === "undefined") {
            console.warn("MisbLibrary not loaded");
            return;
        }

        const result = MisbLibrary.st0601.parse(buf);
        if (result && Array.isArray(result)) {
            const findValue = (name) => {
                const item = result.find((r) => r.name === name);
                return item ? item.value : undefined;
            };

            const lat = findValue("Sensor Latitude");
            const lon = findValue("Sensor Longitude");
            const alt = findValue("Sensor True Altitude");

            const heading = findValue("Platform Heading Angle"); // or Sensor Relative Azimuth?
            const pitch = findValue("Platform Pitch Angle");
            const roll = findValue("Platform Roll Angle");
            const fovHtml = findValue("Sensor Horizontal Field of View");

            if (lat !== undefined && lon !== undefined && alt !== undefined) {
                // Update Camera Position
                const position = Cesium.Cartesian3.fromDegrees(lon, lat, alt);

                // Orientation
                // Note: Cesium HPR is (Heading, Pitch, Roll) in radians.
                // MISB is usually degrees, need to check MisbLibrary output unit.
                // MisbLibrary usually returns numbers, check if they are converted to degrees.
                // Assuming degrees for now, convert to radians.
                // Actually MisbLibrary often returns decoded values in their defined units (often degrees).

                const toRadians = (deg) => Cesium.Math.toRadians(deg || 0);

                // Basic camera set (looking down if no orientation)
                // If we have orientation:

                let orientation = undefined;
                if (heading !== undefined && pitch !== undefined && roll !== undefined) {
                    orientation = new Cesium.HeadingPitchRoll(
                        toRadians(heading),
                        toRadians(pitch),
                        toRadians(roll)
                    );
                }

                // We use setView or move camera? setView for hard sync.
                viewer.camera.setView({
                    destination: position,
                    orientation: orientation
                });

                if (fovHtml !== undefined) {
                    viewer.camera.frustum.fov = toRadians(fovHtml);
                }
            }
        }
    } catch (error) {
        console.error(`[${eventType}] Error parsing KLV:`, error);
    }
}

