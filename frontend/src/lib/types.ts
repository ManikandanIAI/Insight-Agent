// Type definitions for our application

export interface MapPoint {
    layer: 'IconLayer' | 'HexagonLayer';
    latitude: number;
    longitude: number;
    location_name: string;
    description?: string;
    datetime_info?: string;
    numerical_data?: number;
    numerical_data_unit?: string;
  }
  
  export interface UserAnnotation {
    id: string;
    latitude: number;
    longitude: number;
    message: string;
    timestamp: number;
  }
  
  export interface MapState {
    viewState: {
      latitude: number;
      longitude: number;
      zoom: number;
      pitch: number;
      bearing: number;
    };
    selectedPoint: {
      latitude: number;
      longitude: number;
    } | null;
    isModalOpen: boolean;
    message: string;
    annotations: UserAnnotation[];
    activeLayer: 'icon' | 'hexagon' | 'both';
    
    // Action functions
    setViewState: (viewState: any) => void;
    setSelectedPoint: (point: { latitude: number; longitude: number } | null) => void;
    setIsModalOpen: (isOpen: boolean) => void;
    setMessage: (message: string) => void;
    addAnnotation: (annotation: Omit<UserAnnotation, 'id' | 'timestamp'>) => void;
    loadAnnotations: () => void;
    setActiveLayer: (layer: 'icon' | 'hexagon' | 'both') => void;
  }