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

// HUD Elements
const hudEls = {
    lat: document.getElementById("val_lat"),
    lon: document.getElementById("val_lon"),
    alt: document.getElementById("val_alt"),
    heading: document.getElementById("val_heading"),
    pitch: document.getElementById("val_pitch"),
    roll: document.getElementById("val_roll"),
    fov: document.getElementById("val_fov"),
};

const fovToggle = document.getElementById("fovToggle");
const useSensorAnglesToggle = document.getElementById("useSensorAngles");

let packetCount = 0;
let klvBuffer = [];
let firstPts = null;      // PTS of the very first packet (microseconds)

if (fileInput) {
    fileInput.addEventListener("change", function (event) {
        const file = event.target.files[0];
        if (!file) return;

        const fileURL = URL.createObjectURL(file);

        if (mpegts.getFeatureList().mseLivePlayback) {
            // Reset state
            klvBuffer = [];
            packetCount = 0;
            firstPts = null;

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

// Cleanup buffer when new file is loaded
if (fileInput) {
    fileInput.addEventListener("click", () => {
        klvBuffer = [];
        packetCount = 0;
        firstPts = null;
    });
}

// Subscribe to render loop for valid sync
scene.preRender.addEventListener(() => {
    if (!videoElement || videoElement.paused || videoElement.ended || klvBuffer.length === 0) return;

    // Logic: 
    // We assume the first KLV packet we received corresponds to the beginning of the stream (roughly).
    // Or strictly rely on PTS differences.
    // If we assume the video starts at 0s and corresponds to firstPts:
    // currentPts = firstPts + (videoElement.currentTime * 1,000,000)

    if (firstPts === null) return;

    const currentVideoTime = videoElement.currentTime;
    const targetPts = firstPts + (currentVideoTime * 1000000); // Convert seconds to microseconds

    // Find the packet with PTS closest to targetPts
    // Since buffer is ordered (received in order), we can search efficiently or just iterate if buffer isn't huge.

    let bestPacket = null;
    let minDiff = Infinity;

    // Simple linear scan for now. 
    // Optimization idea: keep an index and only search forward?

    for (const packet of klvBuffer) {
        // Optimization: if packet.pts is significantly smaller than targetPts, ignore?
        // But the buffer might grow large. Ideally we slice the buffer.

        const diff = Math.abs(packet.pts - targetPts);
        if (diff < minDiff) {
            minDiff = diff;
            bestPacket = packet;
        } else {
            // If difference starts growing, we passed the sweet spot (assuming sorted buffer)
            // But KLV might be slightly out of order? unlikely for MP4/TS
        }
    }

    if (bestPacket) {
        updateCameraFromPacket(bestPacket);
    }
});

function updateCameraFromPacket(packet) {
    const {
        lat, lon, alt,
        heading, pitch, roll,
        fovHtml,
        sensorRelAzimuth, sensorRelElevation, sensorRelRoll
    } = packet;

    // Update HUD
    if (hudEls.lat) hudEls.lat.textContent = lat?.toFixed(6) ?? "N/A";
    if (hudEls.lon) hudEls.lon.textContent = lon?.toFixed(6) ?? "N/A";
    if (hudEls.alt) hudEls.alt.textContent = alt?.toFixed(1) ?? "N/A";
    if (hudEls.heading) hudEls.heading.textContent = heading?.toFixed(2) ?? "N/A";
    if (hudEls.pitch) hudEls.pitch.textContent = pitch?.toFixed(2) ?? "N/A";
    if (hudEls.roll) hudEls.roll.textContent = roll?.toFixed(2) ?? "N/A";
    if (hudEls.fov) hudEls.fov.textContent = fovHtml?.toFixed(2) ?? "N/A";

    if (lat !== undefined && lon !== undefined && alt !== undefined) {
        const position = Cesium.Cartesian3.fromDegrees(lon, lat, alt);
        const toRadians = (deg) => Cesium.Math.toRadians(deg || 0);

        let orientation = new Cesium.HeadingPitchRoll(0, 90, 0);
        if (heading !== undefined && pitch !== undefined && roll !== undefined) {

            let finalHeading = heading;
            let finalPitch = pitch;
            let finalRoll = roll;

            // Debug: Use Sensor Angles if requested and available
            if (useSensorAnglesToggle && useSensorAnglesToggle.checked &&
                sensorRelAzimuth !== undefined && sensorRelElevation !== undefined && sensorRelRoll !== undefined) {

                // Simple addition for small angles / "Look" direction
                // Note: This is an approximation. 
                // Heading is 0..360.
                finalHeading = (heading + sensorRelAzimuth) % 360;
                finalPitch = pitch + sensorRelElevation;
                finalRoll = roll + sensorRelRoll;
            }

            orientation = new Cesium.HeadingPitchRoll(
                toRadians(finalHeading),
                toRadians(finalPitch),
                toRadians(finalRoll)
            );
        }

        viewer.camera.setView({
            destination: position,
            orientation: orientation
        });

        if (fovHtml !== undefined) {
            const fovRad = toRadians(fovHtml);
            if (fovRad > 0.001 && fovRad < Math.PI) {
                // Check FOV Toggle
                if (!fovToggle || fovToggle.checked) {
                    viewer.camera.frustum.fov = fovRad;
                }
            }
        }
    }
}

function handleMetadata(eventType, data) {
    packetCount++;
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

            const pts = findValue("Precision Time Stamp");
            const lat = findValue("Sensor Latitude");
            const lon = findValue("Sensor Longitude");
            const alt = findValue("Sensor True Altitude");

            const heading = findValue("Platform Heading Angle");
            const pitch = findValue("Platform Pitch Angle");
            const roll = findValue("Platform Roll Angle");
            const fovHtml = findValue("Sensor Horizontal Field of View");

            const sensorRelAzimuth = findValue("Sensor Relative Azimuth Angle");
            const sensorRelElevation = findValue("Sensor Relative Elevation Angle");
            const sensorRelRoll = findValue("Sensor Relative Roll Angle");

            if (shouldLog) {
                // console.log(`[${eventType}] Pkt #${packetCount} Values:`, { lat, lon, alt, heading, pitch, roll, fovHtml });
            }

            if (pts !== undefined) {
                if (firstPts === null) {
                    firstPts = pts;
                    console.log("First PTS established:", firstPts);
                }

                klvBuffer.push({
                    pts,
                    lat,
                    lon,
                    alt,
                    heading,
                    pitch,
                    roll,
                    fovHtml,
                    sensorRelAzimuth,
                    sensorRelElevation,
                    sensorRelRoll
                });
            }
        }
    } catch (error) {
        console.error(`[${eventType}] Error parsing KLV:`, error);
    }
}
