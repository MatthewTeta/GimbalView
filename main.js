import * as Cesium from "cesium";
import mpegts from "mpegts.js";
import { Buffer } from "buffer";
import * as EGM96 from "egm96-universal";

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
const videoContainer = document.getElementById("videoContainer");

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
const altOffsetInput = document.getElementById("altOffset");
const azBiasInput = document.getElementById("azBias");
const elBiasInput = document.getElementById("elBias");
const rollBiasInput = document.getElementById("rollBias");
const fovBiasInput = document.getElementById("fovBias");

const toggleHudBtn = document.getElementById("toggleHudBtn");

let lastKlvData = null; // Store last packet for paused updates

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

if (toggleHudBtn) {
    toggleHudBtn.addEventListener("click", () => {
        const hud = document.getElementById("hudContent");
        if (hud) {
            hud.style.display = hud.style.display === "none" ? "block" : "none";
        }
    });
}

const blendModeSelect = document.getElementById("blendModeSelect");
if (blendModeSelect) {
    blendModeSelect.addEventListener("change", (e) => {
        if (videoContainer) {
            videoContainer.style.mixBlendMode = e.target.value;
        }
    });
}

// Calibration Button Logic
document.querySelectorAll(".adjust-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        const targetId = btn.dataset.target;
        const action = btn.dataset.action;
        const step = parseFloat(btn.dataset.step) || 0.1; // Default step if not specified
        const input = document.getElementById(targetId);

        if (!input) return;

        let currentVal = parseFloat(input.value);

        if (action === "increase") {
            currentVal += step;
        } else if (action === "decrease") {
            currentVal -= step;
        } else if (action === "reset") {
            currentVal = parseFloat(input.defaultValue) || 0;
        }

        // Clamp
        const max = parseFloat(input.max);
        const min = parseFloat(input.min);
        if (currentVal > max) currentVal = max;
        if (currentVal < min) currentVal = min;

        // Round to avoid float errors (optional but good for display)
        // Using logic based on step size to determine precision
        currentVal = Math.round(currentVal * 1 / step) / (1 / step);

        input.value = currentVal;

        // Update Label
        input.dispatchEvent(new Event("input", { bubbles: true }));

        // Force update if paused
        if (videoElement && videoElement.paused && lastKlvData) {
            updateCameraFromPacket(lastKlvData);
        }
    });
});


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
    if (!videoElement || videoElement.ended || klvBuffer.length === 0) return;

    if (videoElement.paused) {
        if (lastKlvData) {
            updateCameraFromPacket(lastKlvData);
        }
        return;
    }

    if (firstPts === null) return;

    const currentVideoTime = videoElement.currentTime;

    // Get Delay in Seconds
    const delayMs = parseFloat(dataDelayInput ? dataDelayInput.value : 0) || 0;
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
        sumFov += (p.fov || 0);

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
        fov: sumFov / count,
        sensorRelAzimuth: sumSensorAz / count,
        sensorRelElevation: sumSensorEl / count,
        sensorRelRoll: sumSensorRoll / count,
        frameCenterLat: sumCenterLat / count,
        frameCenterLon: sumCenterLon / count,
        frameCenterAlt: sumCenterAlt / count
    };
}

let updateCount = 0;
function updateCameraFromPacket(packet) {
    lastKlvData = packet; // Update global last packet
    updateCount++;
    const shouldLog = updateCount % 60 === 0;

    const {
        lat, lon, alt,
        heading, pitch, roll,
        fov,
        sensorRelAzimuth, sensorRelElevation, sensorRelRoll,
        frameCenterLat, frameCenterLon, frameCenterAlt
    } = packet;

    // Calibration Values
    const altOffset = parseFloat(altOffsetInput ? altOffsetInput.value : 0) || 0;
    const azBias = parseFloat(azBiasInput ? azBiasInput.value : 0) || 0;
    const elBias = parseFloat(elBiasInput ? elBiasInput.value : 0) || 0;
    const rollBias = parseFloat(rollBiasInput ? rollBiasInput.value : 0) || 0;
    const fovBias = parseFloat(fovBiasInput ? fovBiasInput.value : 0) || 0;

    // Apply Altitude Offset
    const adjustedAlt = (alt !== undefined) ? alt + altOffset : undefined;
    const adjustedCenterAlt = (frameCenterAlt !== undefined) ? frameCenterAlt + altOffset : undefined;

    // Apply Sensor Biases - these affect the sensor relative angles
    const adjustedSensorAz = (sensorRelAzimuth !== undefined) ? sensorRelAzimuth + azBias : undefined;
    const adjustedSensorEl = (sensorRelElevation !== undefined) ? sensorRelElevation + elBias : undefined;
    const adjustedSensorRoll = (sensorRelRoll !== undefined) ? sensorRelRoll + rollBias : undefined;

    // if (shouldLog) {
    //     console.log(`updateCameraFromPacket`, {
    //         altOffset: altOffset,
    //         azBias: azBias,
    //         elBias: elBias,
    //         rollBias: rollBias,
    //         adjustedAlt: adjustedAlt,
    //         adjustedCenterAlt: adjustedCenterAlt,
    //         adjustedSensorAz: adjustedSensorAz,
    //         adjustedSensorEl: adjustedSensorEl,
    //         adjustedSensorRoll: adjustedSensorRoll
    //     });
    // }

    if (lat === undefined || lon === undefined || adjustedAlt === undefined) return;

    const platformPos = Cesium.Cartesian3.fromDegrees(lon, lat, adjustedAlt);
    const toRadians = (deg) => Cesium.Math.toRadians(deg || 0);

    if (frameCenterLat === undefined || frameCenterLon === undefined) {
        console.log("frameCenterLat or frameCenterLon is undefined");
    }

    // 1. Priority: Frame Center (LookAt)
    if (useFrameCenterToggle?.checked && frameCenterLat !== undefined && frameCenterLon !== undefined) {
        const centerPos = Cesium.Cartesian3.fromDegrees(frameCenterLon, frameCenterLat, adjustedCenterAlt || 0);

        // 1. Define the Platform's Body Frame (Orientation in ECEF)
        const platformHPR = new Cesium.HeadingPitchRoll(toRadians(heading), toRadians(pitch), toRadians(roll));
        const platformTransform = Cesium.Transforms.headingPitchRollToFixedFrame(platformPos, platformHPR);

        // 2. Calculate the Vector to the Target in World Space (ECEF)
        const targetVectorECEF = Cesium.Cartesian3.subtract(centerPos, platformPos, new Cesium.Cartesian3());
        Cesium.Cartesian3.normalize(targetVectorECEF, targetVectorECEF);

        // 3. APPLY BIASES: We need the target vector in the Platform's local frame
        const invPlatformTransform = Cesium.Matrix4.inverse(platformTransform, new Cesium.Matrix4());
        const targetVectorBody = Cesium.Matrix4.multiplyByPointAsVector(invPlatformTransform, targetVectorECEF, new Cesium.Cartesian3());

        // Apply az/el biases to the local body vector
        const rangeBody = Cesium.Cartesian3.magnitude(targetVectorBody);
        let bAz = Math.atan2(targetVectorBody.x, targetVectorBody.y) + toRadians(azBias);
        let bEl = Math.asin(targetVectorBody.z / rangeBody) + toRadians(elBias);

        const correctedBodyDir = new Cesium.Cartesian3(
            Math.cos(bEl) * Math.sin(bAz),
            Math.cos(bEl) * Math.cos(bAz),
            Math.sin(bEl)
        );

        // 4. Transform corrected direction back to World Space
        const correctedDirECEF = Cesium.Matrix4.multiplyByPointAsVector(platformTransform, correctedBodyDir, new Cesium.Cartesian3());

        // 5. CRITICAL STEP: Define "Up" as the Aircraft's "Top" (Z-Axis of the platformTransform)
        // This prevents the "spinning map" at nadir because the camera's 'Up' 
        // is now locked to the plane's roof, not the Earth's North Pole.
        const aircraftUpECEF = new Cesium.Cartesian3();
        Cesium.Matrix4.getColumn(platformTransform, 2, aircraftUpECEF); // Gets the Z column (Up)

        viewer.camera.setView({
            destination: platformPos,
            orientation: {
                direction: correctedDirECEF,
                up: aircraftUpECEF
            }
        });

        // 6. Apply the final relative Sensor Roll
        // We use negative because twistLeft is counter-clockwise
        viewer.camera.twistLeft(-toRadians(adjustedSensorRoll || 0));

    } else {
        // Reset lookAt transform if it was active
        if (viewer.camera.lookAtTransformSupported && viewer.camera.transform !== Cesium.Matrix4.IDENTITY) {
            viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
        }

        let h = 0, p = -90, r = 0;

        // 2. Priority: Combined Platform + Sensor
        if (combineAnglesToggle?.checked) {
            h = (heading || 0) + (adjustedSensorAz || 0);
            p = (pitch || 0) + (adjustedSensorEl || 0);
            r = (roll || 0) + (adjustedSensorRoll || 0);
        }
        // 3. Priority: Sensor Only
        else if (useSensorAnglesToggle?.checked) {
            h = adjustedSensorAz || 0;
            p = adjustedSensorEl || 0;
            r = adjustedSensorRoll || 0;
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
    if (hudEls.platformAlt) hudEls.platformAlt.textContent = adjustedAlt?.toFixed(1) ?? "N/A";
    if (hudEls.platformHeading) hudEls.platformHeading.textContent = heading?.toFixed(2) ?? "N/A";
    if (hudEls.platformPitch) hudEls.platformPitch.textContent = pitch?.toFixed(2) ?? "N/A";
    if (hudEls.platformRoll) hudEls.platformRoll.textContent = roll?.toFixed(2) ?? "N/A";

    // Display biased sensor values? Or raw? Let's display RAW sensor values for debugging, OR biased.
    // Ideally user wants to know what's BEING USED. Let's show adjusted.
    if (hudEls.sensorAzimuth) hudEls.sensorAzimuth.textContent = sensorRelAzimuth?.toFixed(2) ?? "N/A";
    if (hudEls.sensorElevation) hudEls.sensorElevation.textContent = sensorRelElevation?.toFixed(2) ?? "N/A";
    if (hudEls.sensorRoll) hudEls.sensorRoll.textContent = sensorRelRoll?.toFixed(2) ?? "N/A";

    // FOV Handling
    let fov2 = fov + fovBias;
    let fovToUse = fov2;

    // If Slave FOV is OFF, use Manual Slider
    if (!fovToggle || !fovToggle.checked) {
        const manFov = parseFloat(manualFovInput ? manualFovInput.value : 18) || 18;
        fovToUse = manFov; // Use raw degrees here, converted below
    }

    if (hudEls.fov) hudEls.fov.textContent = fovToUse?.toFixed(2) ?? "N/A";

    if (fovToUse !== undefined) {
        const fovRad = toRadians(fovToUse);
        if (fovRad > 0.001 && fovRad < Math.PI) {
            viewer.camera.frustum.fov = fovRad;
        }

        // --- Video Scaling ---
        // Scale the video element so its visual FOV matches the Map's FOV.
        // Concept: If Map is zoomed IN (small FOV), Video should look BIGGER (Scale > 1).
        // Scale = tan(VideoFOV / 2) / tan(MapFOV / 2)
        if (fov2 !== undefined && videoElement) {
            const videoFovRad = toRadians(fov2);
            const mapFovRad = fovRad; // The one we just set
            // console.log("fovToUse", fovToUse);
            // console.log("fovRad", fovRad);
            // console.log("videoFovRad", videoFovRad);
            // console.log("mapFovRad", mapFovRad);

            // Avoid divide by zero
            if (mapFovRad > 0.0001) {
                const scale = Math.tan(videoFovRad / 2) / Math.tan(mapFovRad / 2);
                videoElement.style.transform = `scale(${scale})`;
            }
        }
    }
}

function handleMetadata(eventType, data) {
    packetCount++;
    const shouldLog = packetCount < 10 || packetCount % 60 === 0;
    const convertToHAE = true;

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
            let alt = findValue("Sensor True Altitude"); // MSL!!!

            const heading = findValue("Platform Heading Angle");
            const pitch = findValue("Platform Pitch Angle");
            const roll = findValue("Platform Roll Angle");
            const fov = findValue("Sensor Horizontal Field of View");

            const sensorRelAzimuth = findValue("Sensor Relative Azimuth Angle");
            const sensorRelElevation = findValue("Sensor Relative Elevation Angle");
            const sensorRelRoll = findValue("Sensor Relative Roll Angle");

            const frameCenterLat = findValue("Frame Center Latitude");
            const frameCenterLon = findValue("Frame Center Longitude");
            let frameCenterAlt = findValue("Frame Center Elevation") || 0; // MSL!!!

            // Convert to HAE
            if (convertToHAE) {
                alt = EGM96.egm96ToEllipsoid(lat, lon, alt);
                frameCenterAlt = EGM96.egm96ToEllipsoid(frameCenterLat, frameCenterLon, frameCenterAlt);
            }

            if (shouldLog) {
                // console.log(`[${eventType}] Pkt #${packetCount} Values:`, { lat, lon, alt, heading, pitch, roll, fov });
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
                    fov,
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
