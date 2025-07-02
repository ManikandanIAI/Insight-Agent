// State management using Zustand

import { create } from 'zustand';
import { MapState, UserAnnotation } from './types';
import { v4 as uuidv4 } from 'uuid';

// Initial center coordinates (roughly center of the world map)
const INITIAL_LATITUDE = 20;
const INITIAL_LONGITUDE = 0;

export const useMapStore = create<MapState>((set, get) => ({
  viewState: {
    latitude: INITIAL_LATITUDE,
    longitude: INITIAL_LONGITUDE,
    zoom: 1.5,
    pitch: 0,
    bearing: 0,
  },
  selectedPoint: null,
  isModalOpen: false,
  message: '',
  annotations: [],
  activeLayer: 'both',

  setViewState: (viewState) => set({ viewState }),
  
  setSelectedPoint: (point) => set({ selectedPoint: point }),
  
  setIsModalOpen: (isOpen) => set({ isModalOpen: isOpen }),
  
  setMessage: (message) => set({ message }),
  
  addAnnotation: ({ latitude, longitude, message }) => {
    const newAnnotation: UserAnnotation = {
      id: uuidv4(),
      latitude,
      longitude,
      message,
      timestamp: Date.now(),
    };
    
    const updatedAnnotations = [...get().annotations, newAnnotation];
    set({ annotations: updatedAnnotations });
    
    // Save to local storage
    localStorage.setItem('mapAnnotations', JSON.stringify(updatedAnnotations));
    
    // Close modal and reset form
    set({ isModalOpen: false, message: '', selectedPoint: null });
  },
  
  loadAnnotations: () => {
    try {
      const storedAnnotations = localStorage.getItem('mapAnnotations');
      if (storedAnnotations) {
        set({ annotations: JSON.parse(storedAnnotations) });
      }
    } catch (error) {
      console.error('Error loading annotations from localStorage:', error);
    }
  },
  
  setActiveLayer: (layer) => set({ activeLayer: layer }),
}));