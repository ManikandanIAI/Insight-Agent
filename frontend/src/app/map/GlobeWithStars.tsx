"use client"

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { googleProtocol, createGoogleStyle } from './index.js';

declare global {
    interface Window {
        maplibregl: any;
    }
}

const GlobeWithStars = () => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const threeContainer = useRef<HTMLDivElement>(null);
    const map = useRef<any>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    

    useEffect(() => {
        const loadMapLibre = async () => {
            const cssLink = document.createElement("link");
            cssLink.rel = "stylesheet";
            cssLink.href = "https://unpkg.com/maplibre-gl@5.5.0/dist/maplibre-gl.css";
            document.head.appendChild(cssLink);

            const script = document.createElement("script");
            script.src = "https://unpkg.com/maplibre-gl@5.5.0/dist/maplibre-gl.js";
            script.onload = () => setIsLoaded(true);
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
        };
    }, []);

    useEffect(() => {
        if (!isLoaded || !mapContainer.current || !threeContainer.current) return;
        window.maplibregl.addProtocol('google', googleProtocol);
        // Setup MapLibre map
        map.current = new window.maplibregl.Map({
            container: mapContainer.current,
            style: createGoogleStyle('google', 'satellite', "AIzaSyAQmDB_py7HWww8oPDwdngJ-apRg9lGTjA"),
            center: [23.4, 53.8],
            zoom: 2,
            pitch: 0,
            bearing: 0,
            projection: { type: "globe" }
        });

        map.current.on("style.load", () => {
            map.current.setLight({ anchor: "viewport", intensity: 0.6 });
        });

        // Setup THREE.js renderer
        const renderer = new THREE.WebGLRenderer({ alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        threeContainer.current!.appendChild(renderer.domElement);

        // Setup camera and scene
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1000);
        camera.position.z = 5;

        // Add starfield
        const starTexture = new THREE.TextureLoader().load("https://upload.wikimedia.org/wikipedia/commons/3/3f/Hubble_Interacting_Galaxy_AM_0500-620_%28cropped%29.jpg");
        const starGeo = new THREE.SphereGeometry(500, 64, 64);
        const starMat = new THREE.MeshBasicMaterial({
            map: starTexture,
            side: THREE.BackSide
        });
        const starMesh = new THREE.Mesh(starGeo, starMat);
        scene.add(starMesh);

        // Animate loop
        const animate = () => {
            requestAnimationFrame(animate);

            // Slowly rotate starfield for subtle motion
            starMesh.rotation.y += 0.0005;

            renderer.render(scene, camera);
        };
        animate();

        // Sync camera on move
        map.current.on("move", () => {
            const pitch = map.current.getPitch();
            const bearing = map.current.getBearing();

            camera.rotation.x = -pitch * Math.PI / 180;
            camera.rotation.y = -bearing * Math.PI / 180;
        });

        // Handle resize
        window.addEventListener("resize", () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            renderer.setSize(width, height);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
        });

    }, [isLoaded]);

    return (
        <div className="relative w-full h-screen">
            <div ref={mapContainer} className="absolute top-0 left-0 w-full h-full z-10" />
            <div ref={threeContainer} className="absolute top-0 left-0 w-full h-full z-0" />
        </div>
    );
};

export default GlobeWithStars;
