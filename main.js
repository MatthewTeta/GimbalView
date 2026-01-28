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
const useFrameCenterToggle = document.getElementById("useFrameCenter");
const dataDelayInput = document.getElementById("dataDelay");
const avgWindowInput = document.getElementById("avgWindow");
const manualFovInput = document.getElementById("manualFov");
const videoOpacityInput = document.getElementById("videoOpacity");
const playPauseBtn = document.getElementById("playPauseBtn");

// Controls Logic
if (videoOpacityInput) {
    videoOpacityInput.addEventListener("input", (e) => {
        const val = e.target.value;
        if (videoElement) {
            videoElement.style.opacity = val;
        }
        const label = document.getElementById("val_opacity");
        if (label) label.textContent = val;
    });
}

if (playPauseBtn) {
    playPauseBtn.addEventListener("click", () => {
        if (videoElement) {
            if (videoElement.paused) {
                videoElement.play();
                playPauseBtn.textContent = "Pause";
            } else {
                videoElement.pause();
                playPauseBtn.textContent = "Play";
            }
        }
    });
}


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
            if (playPauseBtn) playPauseBtn.textContent = "Pause";

            // Show video element for debugging - NO LONGER NEEDED (handled by CSS overlay)
            // videoElement.style.display = "block";

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
    let sumCenterLat = 0, sumCenterLon = 0, sumCenterAlt = 0;

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

        sumCenterLat += (p.frameCenterLat || 0);
        sumCenterLon += (p.frameCenterLon || 0);
        sumCenterAlt += (p.frameCenterAlt || 0);
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
        sensorRelRoll: sumSensorRoll / count,
        frameCenterLat: sumCenterLat / count,
        frameCenterLon: sumCenterLon / count,
        frameCenterAlt: sumCenterAlt / count
    };
}

function updateCameraFromPacket(packet) {
    const {
        lat, lon, alt,
        heading, pitch, roll,
        fovHtml,
        sensorRelAzimuth, sensorRelElevation, sensorRelRoll,
        frameCenterLat, frameCenterLon, frameCenterAlt
    } = packet;

    if (lat === undefined || lon === undefined || alt === undefined) return;

    const platformPos = Cesium.Cartesian3.fromDegrees(lon, lat, alt);
    const toRadians = (deg) => Cesium.Math.toRadians(deg || 0);

    // 1. Priority: Frame Center (LookAt)
    if (useFrameCenterToggle?.checked && frameCenterLat !== undefined && frameCenterLon !== undefined) {
        const centerPos = Cesium.Cartesian3.fromDegrees(frameCenterLon, frameCenterLat, frameCenterAlt || 0);

        // viewer.camera.lookAt takes the offset in the local East-North-Up reference frame.
        // We must transform the platform position (ECEF) into the local frame of the center position.

        const transform = Cesium.Transforms.eastNorthUpToFixedFrame(centerPos);
        const invTransform = Cesium.Matrix4.inverse(transform, new Cesium.Matrix4());
        const offsetENU = Cesium.Matrix4.multiplyByPoint(invTransform, platformPos, new Cesium.Cartesian3());

        viewer.camera.lookAt(centerPos, offsetENU);
    } else {
        // Reset lookAt transform if it was active
        if (viewer.camera.lookAtTransformSupported && viewer.camera.transform !== Cesium.Matrix4.IDENTITY) {
            viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
        }

        let h = 0, p = -90, r = 0;

        // 2. Priority: Combined Platform + Sensor
        if (combineAnglesToggle?.checked) {
            h = (heading || 0) + (sensorRelAzimuth || 0);
            p = (pitch || 0) + (sensorRelElevation || 0);
            r = (roll || 0) + (sensorRelRoll || 0);
        }
        // 3. Priority: Sensor Only
        else if (useSensorAnglesToggle?.checked) {
            h = sensorRelAzimuth || 0;
            p = sensorRelElevation || 0;
            r = sensorRelRoll || 0;
        }
        // 4. Fallback: Look straight down (Nadir)
        else {
            h = heading || 0;
            p = pitch || 0;
            r = roll || 0;
        }

        h = (h + 360) % 360;

        const orientation = new Cesium.HeadingPitchRoll(
            toRadians(h),
            toRadians(p),
            toRadians(r)
        );

        // Update HUD for angles
        if (hudEls.finalHeading) hudEls.finalHeading.textContent = h?.toFixed(2) ?? "N/A";
        if (hudEls.finalPitch) hudEls.finalPitch.textContent = p?.toFixed(2) ?? "N/A";
        if (hudEls.finalRoll) hudEls.finalRoll.textContent = r?.toFixed(2) ?? "N/A";

        viewer.camera.setView({
            destination: platformPos,
            orientation: orientation
        });
    }

    // COMMON HUD Updates
    if (hudEls.platformLat) hudEls.platformLat.textContent = lat?.toFixed(6) ?? "N/A";
    if (hudEls.platformLon) hudEls.platformLon.textContent = lon?.toFixed(6) ?? "N/A";
    if (hudEls.platformAlt) hudEls.platformAlt.textContent = alt?.toFixed(1) ?? "N/A";
    if (hudEls.platformHeading) hudEls.platformHeading.textContent = heading?.toFixed(2) ?? "N/A";
    if (hudEls.platformPitch) hudEls.platformPitch.textContent = pitch?.toFixed(2) ?? "N/A";
    if (hudEls.platformRoll) hudEls.platformRoll.textContent = roll?.toFixed(2) ?? "N/A";
    if (hudEls.sensorAzimuth) hudEls.sensorAzimuth.textContent = sensorRelAzimuth?.toFixed(2) ?? "N/A";
    if (hudEls.sensorElevation) hudEls.sensorElevation.textContent = sensorRelElevation?.toFixed(2) ?? "N/A";
    if (hudEls.sensorRoll) hudEls.sensorRoll.textContent = sensorRelRoll?.toFixed(2) ?? "N/A";

    // FOV Handling
    let fovToUse = fovHtml;

    // If Slave FOV is OFF, use Manual Slider
    if (!fovToggle || !fovToggle.checked) {
        const manFov = parseInt(manualFovInput ? manualFovInput.value : 45) || 45;
        fovToUse = manFov; // Use raw degrees here, converted below
    }

    if (hudEls.fov) hudEls.fov.textContent = fovToUse?.toFixed(2) ?? "N/A";

    if (fovToUse !== undefined) {
        const fovRad = toRadians(fovToUse);
        if (fovRad > 0.001 && fovRad < Math.PI) {
            viewer.camera.frustum.fov = fovRad;
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

            const frameCenterLat = findValue("Frame Center Latitude");
            const frameCenterLon = findValue("Frame Center Longitude");
            const frameCenterAlt = findValue("Frame Center Elevation") || 0; // Default to 0 if missing.

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
                    sensorRelRoll,
                    frameCenterLat,
                    frameCenterLon,
                    frameCenterAlt
                });
            }
        }
    } catch (error) {
        console.error(`[${eventType}] Error parsing KLV:`, error);
    }
}
