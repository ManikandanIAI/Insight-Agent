
"use client";

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { countryData } from "../map/data";
import { googleProtocol } from "../map/index.js";

// TypeScript interfaces
export interface GDPEntry {
    Country: string;
    Ranking: string;
    "Real GDP (Billion $)": string;
    Industries: string;
    latitude: number;
    longitude: number;
}

interface FeatureProperties {
    Country: string;
    Ranking: string;
    "Real GDP (Billion $)": string;
    Industries: string;
    imageID: string;
    hue: number;
}

interface GeoJSONFeature {
    type: "Feature";
    geometry: {
        type: "Point";
        coordinates: [number, number];
    };
    properties: FeatureProperties;
}

interface PulsingDotImage {
    width: number;
    height: number;
    data: Uint8Array;
    context?: CanvasRenderingContext2D;
    onAdd(): void;
    render(): boolean;
}

interface Star {
    x: number;
    y: number;
    z: number;
    size: number;
    brightness: number;
    twinkleSpeed: number;
    twinkleOffset: number;
    originalX: number;
    originalY: number;
}


interface Popup {
    Country: string;
    Ranking: string;
    GDP: number;
    Industries: string;
}

// Global maplibregl declaration for TypeScript
declare global {
    interface Window {
        maplibregl: any;
    }
}

const GalaxyBackground = forwardRef((props, ref) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const targetRotation = useRef({ x: 0, y: 0 });

    useImperativeHandle(ref, () => ({
        setTargetRotation: (x: number, y: number) => {
            targetRotation.current.x = x;
            targetRotation.current.y = y;
        },
    }));

    useFrame(() => {
        if (!meshRef.current) return;

        // Smooth damping
        meshRef.current.rotation.x +=
            (targetRotation.current.x - meshRef.current.rotation.x) * 0.1;
        meshRef.current.rotation.y +=
            (targetRotation.current.y - meshRef.current.rotation.y) * 0.1;
    });

    const texture = useTexture('/images/8k_stars.jpg');

    return (
        <mesh ref={meshRef}>
            <sphereGeometry args={[20, 64, 64]} />
            <meshBasicMaterial map={texture} side={THREE.BackSide} />
        </mesh>
    );
});

const MapLibrePulsingDots: React.FC = () => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const starfieldRef = useRef<HTMLCanvasElement>(null);
    const map = useRef<any>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [maxRank, setMaxRank] = useState<number>(0);
    const [popupData, setPopupData] = useState<Popup>()
    const [countryBoundaries, setCountryBoundaries] = useState<GeoJSON.Feature[]>([]);
    const starsRef = useRef<Star[]>([]);
    const animationFrameRef = useRef<number>(0);
    const dotsVisible = useRef(true);


    const CANVAS_SIZE = 100;
    const STAR_COUNT = 800;

    const galaxyRef = useRef<any>(null);




    const generateStars = (width: number = 1920, height: number = 1080): Star[] => {
        const stars: Star[] = [];
        // Create a larger background area for smooth parallax
        const bgWidth = width * 3;
        const bgHeight = height * 3;

        for (let i = 0; i < STAR_COUNT; i++) {
            stars.push({
                x: Math.random() * bgWidth,
                y: Math.random() * bgHeight,
                z: 0,
                originalX: Math.random() * bgWidth,
                originalY: Math.random() * bgHeight,
                size: Math.random() * 2.5 + 0.2,
                brightness: Math.random() * 0.9 + 0.1,
                twinkleSpeed: Math.random() * 0.008 + 0.002,
                twinkleOffset: Math.random() * Math.PI * 2
            });
        }

        // Add some brighter stars for depth
        for (let i = 0; i < 60; i++) {
            stars.push({
                x: Math.random() * bgWidth,
                y: Math.random() * bgHeight,
                z: 0,
                originalX: Math.random() * bgWidth,
                originalY: Math.random() * bgHeight,
                size: Math.random() * 4 + 1.5,
                brightness: Math.random() * 0.4 + 0.6,
                twinkleSpeed: Math.random() * 0.005 + 0.001,
                twinkleOffset: Math.random() * Math.PI * 2
            });
        }

        return stars;
    };

    function animateStarfield() {
        const canvas = starfieldRef.current!;
        const ctx = canvas.getContext('2d')!;
        const w = canvas.width = window.innerWidth;
        const h = canvas.height = window.innerHeight;

        // … draw your gradient & nebulae here …

        const gradient = ctx.createRadialGradient(
            canvas.width / 2, canvas.height / 2, 0,
            canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height)
        );
        gradient.addColorStop(0, '#0a0815');
        gradient.addColorStop(0.3, '#0d1421');
        gradient.addColorStop(0.6, '#050a18');
        gradient.addColorStop(0.8, '#020610');
        gradient.addColorStop(1, '#000000');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Add NASA-style nebula regions
        const nebulaRegions = [
            { x: canvas.width * 0.2, y: canvas.height * 0.3, color: 'rgba(25, 25, 70, 0.08)' },
            { x: canvas.width * 0.7, y: canvas.height * 0.6, color: 'rgba(50, 20, 60, 0.06)' },
            { x: canvas.width * 0.4, y: canvas.height * 0.8, color: 'rgba(20, 40, 80, 0.05)' },
            { x: canvas.width * 0.8, y: canvas.height * 0.2, color: 'rgba(60, 30, 40, 0.04)' }
        ];

        nebulaRegions.forEach((nebula, i) => {
            const nebulaGrad = ctx.createRadialGradient(
                nebula.x, nebula.y, 0,
                nebula.x, nebula.y, 300 + i * 100
            );
            nebulaGrad.addColorStop(0, nebula.color);
            nebulaGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = nebulaGrad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        });

        // 1) compute map-driven offsets:
        const center = map.current?.getCenter() ?? { lng: 0, lat: 0 };
        const bearing = map.current?.getBearing() ?? 0;
        const pitch = map.current?.getPitch() ?? 0;

        const panStrength = 0.4;
        const rotationStrength = 0.3;

        const panX = (center.lng / 360) * w * panStrength;
        const panY = -(center.lat / 180) * h * panStrength;
        const rotX = bearing * rotationStrength;
        const rotY = pitch * (rotationStrength * 0.2);

        const offsetX = panX + rotX;
        const offsetY = panY + rotY;
        const time = performance.now() * 0.001;
        // 2) apply the transform:
        ctx.save();
        ctx.translate(offsetX, offsetY);

        // 3) draw all your stars (as you already do)…
        starsRef.current.forEach((star) => {
            // Calculate position within the larger background
            const displayX = star.originalX - canvas.width;
            const displayY = star.originalY - canvas.height;

            // Only draw stars that could be visible (including offscreen for smooth movement)
            if (displayX >= -canvas.width && displayX <= canvas.width * 2 &&
                displayY >= -canvas.height && displayY <= canvas.height * 2) {

                // Gentle twinkling effect
                const twinkle = Math.sin(time * star.twinkleSpeed + star.twinkleOffset) * 0.15 + 0.85;
                const alpha = star.brightness * twinkle;

                // Main star - crisp and clean like NASA images
                ctx.beginPath();
                ctx.arc(displayX, displayY, star.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.fill();

                // Subtle glow for larger stars
                if (star.size > 2) {
                    ctx.beginPath();
                    ctx.arc(displayX, displayY, star.size * 2, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.08})`;
                    ctx.fill();
                }

                // Diffraction spikes for brightest stars (like Hubble images)
                if (star.size > 3 && alpha > 0.7) {
                    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.3})`;
                    ctx.lineWidth = 0.5;
                    ctx.beginPath();
                    // Four-point diffraction pattern
                    ctx.moveTo(displayX - star.size * 2, displayY);
                    ctx.lineTo(displayX + star.size * 2, displayY);
                    ctx.moveTo(displayX, displayY - star.size * 2);
                    ctx.lineTo(displayX, displayY + star.size * 2);
                    ctx.stroke();
                }

                // Occasional colored stars (blue giants, red giants)
                if (star.size > 2.5 && Math.random() > 0.98) {
                    const starColors = ['rgba(173, 216, 255, ', 'rgba(255, 204, 111, ', 'rgba(255, 255, 255, '];
                    const colorIndex = Math.floor(Math.random() * starColors.length);
                    ctx.beginPath();
                    ctx.arc(displayX, displayY, star.size * 0.8, 0, Math.PI * 2);
                    ctx.fillStyle = starColors[colorIndex] + (alpha * 0.6) + ')';
                    ctx.fill();
                }
            }
        });

        ctx.restore();

        // loop
        animationFrameRef.current = requestAnimationFrame(animateStarfield);
    }


    // Create pulsing dot factory function
    const createPulsingDot = (hue: number): PulsingDotImage => {
        return {
            width: CANVAS_SIZE,
            height: CANVAS_SIZE,
            data: new Uint8Array(CANVAS_SIZE * CANVAS_SIZE * 4),

            onAdd() {
                const canvas = document.createElement("canvas");
                canvas.width = this.width;
                canvas.height = this.height;
                this.context = canvas.getContext("2d") as CanvasRenderingContext2D;
            },

            render() {
                const duration = 1000;
                const t = (performance.now() % duration) / duration;

                const ctx = this.context!;
                const center = CANVAS_SIZE / 2;
                const maxR = CANVAS_SIZE / 4;
                const minR = maxR * 0.26;
                const outerR = minR + (maxR - minR) * t;

                ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

                // Outer fading circle
                ctx.beginPath();
                ctx.arc(center, center, outerR, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${hue}, 60%, 80%, ${1 - t})`;
                ctx.fill();

                // Inner solid circle
                ctx.beginPath();
                ctx.arc(center, center, minR, 0, Math.PI * 2);
                ctx.fillStyle = `hsl(${hue}, 60%, 70%)`;
                ctx.strokeStyle = "white";
                ctx.lineWidth = 2 * (1 - t);
                ctx.fill();
                ctx.stroke();

                //@ts-ignore
                this.data = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE).data;

                if (map.current) {
                    map.current.triggerRepaint();
                }
                return true;
            }
        };
    };

    function showCountryPolygon(feature: GeoJSON.Feature) {
        // Remove old layer & source if it exists
        if (map.current.getLayer("selected-country-fill")) {
            map.current.removeLayer("selected-country-fill");
        }
        if (map.current.getLayer("selected-country-outline")) {
            map.current.removeLayer("selected-country-outline");
        }
        if (map.current.getSource("selected-country")) {
            map.current.removeSource("selected-country");
        }

        // Add new source
        map.current.addSource("selected-country", {
            type: "geojson",
            data: feature,
        });

        // Add fill layer
        map.current.addLayer({
            id: "selected-country-fill",
            type: "fill",
            source: "selected-country",
            paint: {
                "fill-color": "#0080ff",
                "fill-opacity": 0.4,
            },
        });

        // Add outline layer
        map.current.addLayer({
            id: "selected-country-outline",
            type: "line",
            source: "selected-country",
            paint: {
                "line-color": "#000",
                "line-width": 2,
            },
        });
    }


    const addPulsingDots = async () => {
        if (!map.current || !window.maplibregl) return;

        try {
            const sampleData = countryData;

            const ranks = sampleData.map((e) => Number(e.Ranking));
            const maxRankValue = Math.max(...ranks);
            setMaxRank(maxRankValue);

            const features: GeoJSONFeature[] = sampleData.map((entry) => {
                const rank = Number(entry.Ranking);
                const norm = (rank - 1) / (maxRankValue - 1);
                const hue = 120 - 120 * norm;

                return {
                    type: "Feature",
                    geometry: {
                        type: "Point",
                        coordinates: [entry.longitude, entry.latitude]
                    },
                    properties: {
                        Country: entry.Country,
                        Ranking: entry.Ranking,
                        "Real GDP (Billion $)": entry["Real GDP (Billion $)"],
                        Industries: entry.Industries,
                        imageID: `pulsing-dot-hue-${rank}`,
                        hue: hue
                    }
                };
            });

            const uniqueRanks = [...new Set(features.map((f) => f.properties.Ranking))];
            uniqueRanks.forEach((rankStr) => {
                const sample = features.find((f) => f.properties.Ranking === rankStr);
                if (sample) {
                    const hue = sample.properties.hue;
                    const imageID = sample.properties.imageID;
                    if (!map.current.hasImage(imageID)) {
                        map.current.addImage(imageID, createPulsingDot(hue), { pixelRatio: 2 });
                    }
                }
            });

            const geojson = { type: "FeatureCollection", features: features };
            map.current.addSource("gdp-countries", { type: "geojson", data: geojson });

            map.current.addLayer({
                id: "pulsing-countries",
                type: "symbol",
                source: "gdp-countries",
                layout: {
                    "icon-image": ["get", "imageID"],
                    "icon-allow-overlap": true,
                    "icon-ignore-placement": true
                }
            });

            const popup = new window.maplibregl.Popup({
                closeButton: false,
                closeOnClick: false
            });

            map.current.on("mouseenter", "pulsing-countries", (e: any) => {
                if (map.current) {
                    map.current.getCanvas().style.cursor = "pointer";
                }
                const props = e.features[0].properties;
                const modifiedProps = {
                    Country: props.Country,
                    Ranking: props.Ranking,
                    GDP: Number(
                        props["Real GDP (Billion $)"]
                    ),
                    Industries: props.Industries
                }
                setPopupData(modifiedProps)
            });

            map.current.on("mouseleave", "pulsing-countries", () => {
                if (map.current) {
                    map.current.getCanvas().style.cursor = "";
                }
                popup.remove();
            });

        } catch (err) {
            console.error("Error loading data:", err);
        }
    };



    useEffect(() => {
        if (typeof window !== "undefined") {
            const width = window.innerWidth;
            const height = window.innerHeight;
            starsRef.current = generateStars(width, height);

            setTimeout(() => {
                if (starfieldRef.current && starsRef.current.length > 0) {
                    animateStarfield();
                }
            }, 50);
        }
    }, []);

    useEffect(() => {
        const loadMapLibre = async () => {
            const cssLink = document.createElement("link");
            cssLink.rel = "stylesheet";
            cssLink.href = "https://unpkg.com/maplibre-gl@5.5.0/dist/maplibre-gl.css";
            document.head.appendChild(cssLink);

            const script = document.createElement("script");
            script.src = "https://unpkg.com/maplibre-gl@5.5.0/dist/maplibre-gl.js";
            script.onload = () => {
                setIsLoaded(true);
            };
            document.head.appendChild(script);
        };

        if (!window.maplibregl) {
            loadMapLibre();
        } else {
            setIsLoaded(true);
        }

        return () => {
            if (map.current) {
                map.current.remove();
            }
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, []);

    // Load GeoJSON and set boundaries
    useEffect(() => {
        fetch("/area-boundaries.geojson")
            .then((res) => res.json())
            .then((data) => {
                console.log("Country boundaries loaded:", data.features);
                setCountryBoundaries(data.features);
            });
    }, []);

    useEffect(() => {
        if (!map.current || countryBoundaries.length === 0) return;

        function highlightCountryPolygon(countryName: string) {
            if (!countryName || typeof countryName !== "string") {
                console.warn("Invalid country name passed:", countryName);
                return;
            }

            const match = countryBoundaries.find(
                (feature) =>
                    typeof feature.properties?.name === "string" &&
                    feature.properties.name.toLowerCase() === countryName.toLowerCase()
            );

            if (match) {
                // highlight logic
                showCountryPolygon(match);
                console.log("Found feature:", match);
            } else {
                console.warn("No match found for country:", countryName);
            }
        }

        const handlezoomEnd = () => {
            const zoom = map.current.getZoom();
            const center = map.current.getCenter();

            // Get all rendered pulsing dot features
            const features = map.current.queryRenderedFeatures({
                layers: ["pulsing-countries"],
            });

            if (!features.length) return;

            // Sort by distance to center
            const sorted = features.sort((a: any, b: any) => {
                const aCoords = a.geometry.coordinates;
                const bCoords = b.geometry.coordinates;
                const aDist = Math.hypot(center.lng - aCoords[0], center.lat - aCoords[1]);
                const bDist = Math.hypot(center.lng - bCoords[0], center.lat - bCoords[1]);
                return aDist - bDist;
            });

            const closest = sorted[0];
            const targetCountry = closest?.properties?.Country;

            if (!targetCountry) return;

            // Zoomed in: highlight country and hide its pulsing dot
            if (zoom >= 4) {
                highlightCountryPolygon(targetCountry);

                // Remove dot only for this country using filter
                if (map.current.getLayer("pulsing-countries")) {
                    map.current.setFilter("pulsing-countries", [
                        "!=", ["get", "Country"], targetCountry,
                    ]);
                }
            }

            // Zoomed out: restore all pulsing dots
            if (zoom < 4) {
                if (map.current.getLayer("pulsing-countries")) {
                    map.current.setFilter("pulsing-countries", null);
                }
            }
        };


        // const handlezoomEnd = () => {
        //     const zoom = map.current.getZoom();

        //     if (zoom >= 4 && dotsVisible.current) {
        //         // Zoomed in: remove pulsing dots
        //         if (map.current.getLayer("pulsing-countries")) {
        //             map.current.removeLayer("pulsing-countries");
        //         }
        //         if (map.current.getSource("gdp-countries")) {
        //             map.current.removeSource("gdp-countries");
        //         }
        //         dotsVisible.current = false;
        //         console.log("Pulsing dots removed at zoom", zoom);
        //     }

        //     if (zoom < 4 && !dotsVisible.current) {
        //         // Zoomed out: re-add pulsing dots
        //         addPulsingDots();
        //         dotsVisible.current = true;
        //         console.log("Pulsing dots restored at zoom", zoom);
        //     }

        //     // Check for nearby country to highlight
        //     if (!map.current.getLayer("pulsing-countries")) return;

        //     const center = map.current.getCenter();
        //     const features = map.current.queryRenderedFeatures({
        //         layers: ["pulsing-countries"],
        //     });

        //     if (features.length === 0) return;

        //     const sorted = features.sort((a:any, b:any) => {
        //         const aCoords = a.geometry.coordinates;
        //         const bCoords = b.geometry.coordinates;

        //         const aDist = Math.hypot(center.lng - aCoords[0], center.lat - aCoords[1]);
        //         const bDist = Math.hypot(center.lng - bCoords[0], center.lat - bCoords[1]);

        //         return aDist - bDist;
        //     });

        //     const closest = sorted[0];
        //     const countryName = closest?.properties?.Country;

        //     if (countryName) {
        //         console.log("Zoomed into:", countryName);
        //         highlightCountryPolygon(countryName);
        //     }
        // };

        map.current.on("zoomend", handlezoomEnd);


        return () => {
            map.current.off("zoomend", handlezoomEnd); // clean up
        };
    }, [map.current, countryBoundaries]); // watch for countryBoundaries updates

    useEffect(() => {
        if (!isLoaded || !mapContainer.current || map.current) return;

        window.maplibregl.addProtocol("google", googleProtocol);

        map.current = new window.maplibregl.Map({
            container: mapContainer.current,
            style: 'https://api.maptiler.com/maps/streets/style.json?key=d6Cd7AXxyr4Pqja6z0q3',
            zoom: 2,
            pitch: 0,
            bearing: 0,
        });

        map.current.on("style.load", async () => {
            map.current.setProjection({ type: "globe" });
            map.current.setLight({ anchor: "viewport", intensity: 0.5 });
            addPulsingDots();



        });


        // Respond to ALL map movements (not just Ctrl+drag)
        map.current.on("move", () => {
            // animateStarfield()
            // Background updates automatically via continuous animation
        });

        map.current.on("rotate", () => {
            // Background updates automatically via continuous animation
        });

        map.current.on("pitch", () => {
            // Background updates automatically via continuous animation
        });

        map.current.addControl(new window.maplibregl.NavigationControl());

        // Handle window resize
        const handleResize = () => {
            if (starfieldRef.current) {
                starfieldRef.current.width = window.innerWidth;
                starfieldRef.current.height = window.innerHeight;
            }
            starsRef.current = generateStars(window.innerWidth, window.innerHeight);
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animateStarfield();
            }
        };

        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener("resize", handleResize);
        };
    }, [isLoaded]);

    useEffect(() => {
        const draggingRef = { current: false };
        const lastPos = { current: { x: 0, y: 0 } };
        const rotationRef = { current: { x: 0, y: 0 } };

        const updateRotation = (x: number, y: number) => {
            rotationRef.current.x += y * 0.005; // vertical drag → rotate X
            rotationRef.current.y += x * 0.005; // horizontal drag → rotate Y

            galaxyRef.current?.setTargetRotation(
                rotationRef.current.x,
                rotationRef.current.y
            );
        };

        const handleMouseDown = (e: MouseEvent) => {
            draggingRef.current = true;
            lastPos.current = { x: e.clientX, y: e.clientY };
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (!draggingRef.current) return;

            const dx = e.clientX - lastPos.current.x;
            const dy = e.clientY - lastPos.current.y;

            lastPos.current = { x: e.clientX, y: e.clientY };

            updateRotation(dx, dy);
        };

        const handleMouseUp = () => {
            draggingRef.current = false;
        };

        const handleTouchStart = (e: TouchEvent) => {
            draggingRef.current = true;
            const touch = e.touches[0];
            lastPos.current = { x: touch.clientX, y: touch.clientY };
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!draggingRef.current) return;
            const touch = e.touches[0];

            const dx = touch.clientX - lastPos.current.x;
            const dy = touch.clientY - lastPos.current.y;

            lastPos.current = { x: touch.clientX, y: touch.clientY };

            updateRotation(dx, dy);
        };

        const handleTouchEnd = () => {
            draggingRef.current = false;
        };

        window.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        window.addEventListener('touchstart', handleTouchStart);
        window.addEventListener('touchmove', handleTouchMove);
        window.addEventListener('touchend', handleTouchEnd);
        window.addEventListener('touchcancel', handleTouchEnd);

        return () => {
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);

            window.removeEventListener('touchstart', handleTouchStart);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
            window.removeEventListener('touchcancel', handleTouchEnd);
        };
    }, []);



    return (
        <div className="relative w-full h-[100dvh] overflow-hidden bg-black">
            {/* Universe Starfield Background */}
            <div className="w-screen h-screen bg-black">
                <Canvas camera={{ position: [0, 0, 5] }}>
                    <ambientLight intensity={1} />
                    <GalaxyBackground ref={galaxyRef} />
                    <OrbitControls enableZoom={false} enableRotate={false} />
                </Canvas>
            </div>


            {/* Globe Map Container */}
            <div
                ref={mapContainer}
                className="absolute top-0 left-0 w-full h-full"
                style={{ zIndex: 1, position: 'absolute', inset: '0' }}
            />

            <div className="absolute top-5 left-5 bg-black/80 backdrop-blur-md p-4 rounded-lg shadow-2xl z-10 font-sans text-sm text-white border border-white/20">
                <div className="font-bold mb-2 text-blue-300">GDP Ranking (PPP)</div>
                <div
                    className="w-48 h-4 mb-2 border border-white/30 rounded-sm"
                    style={{
                        background: 'linear-gradient(to right, hsl(120, 60%, 70%), hsl(60, 60%, 70%), hsl(0, 60%, 70%))'
                    }}
                />
                <div className="flex justify-between text-xs text-gray-300">
                    <span>Rank 1 (Highest)</span>
                    <span>Rank {maxRank || 'N'} (Lowest)</span>
                </div>
            </div>

            {/* Cosmic loading indicator when needed */}
            {!isLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-20">
                    <div className="text-white text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
                        <div className="text-blue-300">Loading Space View...</div>
                    </div>
                </div>
            )}

            {popupData && (
                <div className="absolute bottom-4 left-4 z-20 bg-black/80 text-white p-4 rounded-lg shadow-lg border border-white/20 max-w-xs text-sm">
                    <div className="font-bold text-blue-300 mb-1">{popupData.Country}</div>
                    <div>Ranking: {popupData.Ranking}</div>
                    <div>GDP: {Number(popupData.GDP).toLocaleString()} Billion $</div>
                    <div>Industries: {popupData.Industries}</div>
                </div>
            )}

        </div>
    );
};

export default MapLibrePulsingDots;