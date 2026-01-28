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
    fov: document.getElementById("val_fov"),
    platformLat: document.getElementById("val_platform_lat"),
    platformLon: document.getElementById("val_platform_lon"),
    platformAlt: document.getElementById("val_platform_alt"),
    platformHeading: document.getElementById("val_platform_heading"),
    platformPitch: document.getElementById("val_platform_pitch"),
    platformRoll: document.getElementById("val_platform_roll"),
    sensorAzimuth: document.getElementById("val_sensor_azimuth"),
    sensorElevation: document.getElementById("val_sensor_elevation"),
    sensorRoll: document.getElementById("val_sensor_roll"),
    finalHeading: document.getElementById("val_final_heading"),
    finalPitch: document.getElementById("val_final_pitch"),
    finalRoll: document.getElementById("val_final_roll"),
};

const fovToggle = document.getElementById("fovToggle");
const useSensorAnglesToggle = document.getElementById("useSensorAngles");
const combineAnglesToggle = document.getElementById("combineAnglesToggle");
const dataDelayInput = document.getElementById("dataDelay");
const avgWindowInput = document.getElementById("avgWindow");

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

    if (firstPts === null) return;

    const currentVideoTime = videoElement.currentTime;

    // Get Delay in Seconds
    const delayMs = parseInt(dataDelayInput ? dataDelayInput.value : 0) || 0;
    const delaySec = delayMs / 1000.0;

    // Target PTS
    const targetPts = firstPts + ((currentVideoTime - delaySec) * 1000000);

    // Find the best packet INDEX
    let bestIndex = -1;
    let minDiff = Infinity;

    // Simple linear scan (optimization possible)
    for (let i = 0; i < klvBuffer.length; i++) {
        const diff = Math.abs(klvBuffer[i].pts - targetPts);
        if (diff < minDiff) {
            minDiff = diff;
            bestIndex = i;
        }
    }

    if (bestIndex !== -1) {
        // Averaging
        const windowSize = parseInt(avgWindowInput ? avgWindowInput.value : 1) || 1;
        const halfWindow = Math.floor(windowSize / 2);

        // let start = Math.max(0, bestIndex - halfWindow);
        // let end = Math.min(klvBuffer.length - 1, bestIndex + halfWindow);
        let start = Math.max(0, bestIndex - windowSize);
        let end = Math.min(klvBuffer.length - 1, bestIndex);

        // Filter valid packets in range to avoid undefined values infecting average
        const packetsToAvg = [];
        for (let i = start; i <= end; i++) {
            packetsToAvg.push(klvBuffer[i]);
        }

        if (packetsToAvg.length > 0) {
            const avgPacket = computeAveragePacket(packetsToAvg);
            updateCameraFromPacket(avgPacket);
        }
    }
});

function toRad(deg) {
    return (deg * Math.PI) / 180;
}

function toDeg(rad) {
    return (rad * 180) / Math.PI;
}

function computeAveragePacket(packets) {
    let sumLat = 0, sumLon = 0, sumAlt = 0;
    let sumPitch = 0, sumRoll = 0, sumFov = 0;
    let sumSensorAz = 0, sumSensorEl = 0, sumSensorRoll = 0;

    // // Circular mean for Heading
    // let sumSinHeading = 0;
    // let sumCosHeading = 0;
    let sumHeading = 0;

    let count = packets.length;

    for (const p of packets) {
        sumLat += (p.lat || 0);
        sumLon += (p.lon || 0);
        sumAlt += (p.alt || 0);

        // Heading wrapping
        // const hRad = toRad(p.heading || 0);
        // sumSinHeading += Math.sin(hRad);
        // sumCosHeading += Math.cos(hRad);
        sumHeading += (p.heading || 0);

        sumPitch += (p.pitch || 0);
        sumRoll += (p.roll || 0);
        sumFov += (p.fovHtml || 0);

        sumSensorAz += (p.sensorRelAzimuth || 0);
        sumSensorEl += (p.sensorRelElevation || 0);
        sumSensorRoll += (p.sensorRelRoll || 0);
    }

    // const avgHeadingRad = Math.atan2(sumSinHeading / count, sumCosHeading / count);
    // const avgHeading = (toDeg(avgHeadingRad) + 360) % 360;
    const avgHeading = sumHeading / count;

    return {
        lat: sumLat / count,
        lon: sumLon / count,
        alt: sumAlt / count,
        heading: avgHeading,
        pitch: sumPitch / count,
        roll: sumRoll / count,
        fovHtml: sumFov / count,
        sensorRelAzimuth: sumSensorAz / count,
        sensorRelElevation: sumSensorEl / count,
        sensorRelRoll: sumSensorRoll / count
    };
}

function updateCameraFromPacket(packet) {
    const {
        lat, lon, alt,
        heading, pitch, roll,
        fovHtml,
        sensorRelAzimuth, sensorRelElevation, sensorRelRoll
    } = packet;

    if (lat !== undefined && lon !== undefined && alt !== undefined) {
        const position = Cesium.Cartesian3.fromDegrees(lon, lat, alt);
        const toRadians = (deg) => Cesium.Math.toRadians(deg || 0);

        let orientation = new Cesium.HeadingPitchRoll(0, 90, 0);
        if (heading !== undefined && pitch !== undefined && roll !== undefined) {

            let finalHeading = 0;
            let finalPitch = 0;
            let finalRoll = 0;
            if (combineAnglesToggle && combineAnglesToggle.checked) {
                finalHeading += heading;
                finalPitch += pitch;
                finalRoll += roll;
            }

            // Debug: Use Sensor Angles if requested and available
            if (useSensorAnglesToggle && useSensorAnglesToggle.checked &&
                sensorRelAzimuth !== undefined && sensorRelElevation !== undefined && sensorRelRoll !== undefined) {

                // Simple addition for small angles / "Look" direction
                // Note: This is an approximation. 
                // Heading is 0..360.
                finalHeading += sensorRelAzimuth;
                finalPitch += sensorRelElevation;
                finalRoll += sensorRelRoll;
            }

            finalHeading = (finalHeading + 360) % 360;

            // Update HUD
            if (hudEls.fov) hudEls.fov.textContent = fovHtml?.toFixed(2) ?? "N/A";
            if (hudEls.platformLat) hudEls.platformLat.textContent = lat?.toFixed(6) ?? "N/A";
            if (hudEls.platformLon) hudEls.platformLon.textContent = lon?.toFixed(6) ?? "N/A";
            if (hudEls.platformAlt) hudEls.platformAlt.textContent = alt?.toFixed(1) ?? "N/A";
            if (hudEls.platformHeading) hudEls.platformHeading.textContent = heading?.toFixed(2) ?? "N/A";
            if (hudEls.platformPitch) hudEls.platformPitch.textContent = pitch?.toFixed(2) ?? "N/A";
            if (hudEls.platformRoll) hudEls.platformRoll.textContent = roll?.toFixed(2) ?? "N/A";
            if (hudEls.sensorAzimuth) hudEls.sensorAzimuth.textContent = sensorRelAzimuth?.toFixed(2) ?? "N/A";
            if (hudEls.sensorElevation) hudEls.sensorElevation.textContent = sensorRelElevation?.toFixed(2) ?? "N/A";
            if (hudEls.sensorRoll) hudEls.sensorRoll.textContent = sensorRelRoll?.toFixed(2) ?? "N/A";
            if (hudEls.finalHeading) hudEls.finalHeading.textContent = finalHeading?.toFixed(2) ?? "N/A";
            if (hudEls.finalPitch) hudEls.finalPitch.textContent = finalPitch?.toFixed(2) ?? "N/A";
            if (hudEls.finalRoll) hudEls.finalRoll.textContent = finalRoll?.toFixed(2) ?? "N/A";

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
