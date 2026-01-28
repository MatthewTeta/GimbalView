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

let lastLogTime = 0;
let packetCount = 0;

function handleMetadata(eventType, data) {
    packetCount++;
    // Log every 60 packets (approx 1 sec at 60Hz) or if it's the first few
    const shouldLog = packetCount < 10 || packetCount % 60 === 0;

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

        if (typeof MisbLibrary === "undefined") {
            if (shouldLog) console.warn("MisbLibrary not loaded");
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

            const heading = findValue("Platform Heading Angle");
            const pitch = findValue("Platform Pitch Angle");
            const roll = findValue("Platform Roll Angle");
            const fovHtml = findValue("Sensor Horizontal Field of View");

            if (shouldLog) {
                console.log(`[${eventType}] Pkt #${packetCount} Values:`, { lat, lon, alt, heading, pitch, roll, fovHtml });
            }

            if (lat !== undefined && lon !== undefined && alt !== undefined) {
                // Update Camera Position
                const position = Cesium.Cartesian3.fromDegrees(lon, lat, alt);

                const toRadians = (deg) => Cesium.Math.toRadians(deg || 0);

                // Orientation
                let orientation = undefined;
                if (heading !== undefined && pitch !== undefined && roll !== undefined) {
                    // Cesium HPR: Heading (North=0, CW), Pitch (Horizon=0, Down=-), Roll (RightDown=+)
                    // Ensure units are correct.
                    orientation = new Cesium.HeadingPitchRoll(
                        toRadians(heading),
                        toRadians(pitch),
                        toRadians(roll)
                    );
                }

                viewer.camera.setView({
                    destination: position,
                    orientation: orientation
                });

                if (fovHtml !== undefined) {
                    // Apply FOV if reasonable (prevent extreme zooms if data is weird, though 1 deg is valid for sensors)
                    const fovRad = toRadians(fovHtml);
                    if (fovRad > 0.001 && fovRad < Math.PI) {
                        viewer.camera.frustum.fov = fovRad;
                    }
                }
            } else {
                if (shouldLog) console.warn(`[${eventType}] Missing required position data in packet #${packetCount}`);
            }
        } else {
            if (shouldLog) console.warn(`[${eventType}] Failed to parse KLV or empty result in packet #${packetCount}`);
        }
    } catch (error) {
        console.error(`[${eventType}] Error parsing KLV:`, error);
    }
}
