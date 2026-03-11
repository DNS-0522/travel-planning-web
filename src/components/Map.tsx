import React, { useState, useEffect, useCallback, useRef } from 'react';
import WeatherWidget from './WeatherWidget';
import { Car, Train, Bike, Footprints, Loader2, X } from 'lucide-react';
import { GoogleMap, useJsApiLoader, DirectionsService, DirectionsRenderer } from '@react-google-maps/api';

interface MapProps {
  items: any[];
  travelMode: string;
  onTravelModeChange?: (mode: string) => void;
  selectedItemId?: string | null;
  isModalOpen?: boolean;
}

const containerStyle = {
  width: '100%',
  height: '100%'
};

const center = {
  lat: 23.6978,
  lng: 120.9605
};

export default function MapView({ items, travelMode, onTravelModeChange, selectedItemId, isModalOpen }: MapProps) {
  // @ts-ignore
  const apiKey = (import.meta.env?.VITE_GOOGLE_MAPS_API_KEY) || process.env.VITE_GOOGLE_MAPS_API_KEY || '';
  
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey
  });

  const [response, setResponse] = useState<google.maps.DirectionsResult | null>(null);
  const [routeIndex, setRouteIndex] = useState(0);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  const directionsCallback = useCallback((res: google.maps.DirectionsResult | null, status: google.maps.DirectionsStatus) => {
    if (res !== null && status === 'OK') {
      setResponse(res);
      setRouteIndex(0);
      setErrorStatus(null);
    } else {
      console.error(`Directions request failed: ${status}`);
      setErrorStatus(status);
      setResponse(null);
    }
  }, []);

  useEffect(() => {
    setResponse(null);
    setErrorStatus(null);
  }, [items, travelMode, selectedItemId]);

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const onUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  const getTargetCity = () => {
    const selectedItem = items.find(i => i.id === selectedItemId);
    if (selectedItem) return selectedItem.place_name;
    if (items.length > 0) return items[0].place_name;
    return "Taipei";
  };

  // Error UI for missing API Key or Load Error
  if (!apiKey || loadError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900 p-6 text-center">
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl max-w-md border border-red-100 dark:border-red-900/30">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Google Maps 設定錯誤</h3>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            {!apiKey 
              ? "尚未偵測到 API 金鑰。請在環境變數中設定 VITE_GOOGLE_MAPS_API_KEY。" 
              : "地圖載入失敗。請檢查您的 API 金鑰是否有效且已啟用 Maps JavaScript API。"}
          </p>
          <a 
            href="https://console.cloud.google.com/google/maps-apis/api-list" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-block px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
          >
            前往 Google Cloud 控制台
          </a>
        </div>
      </div>
    );
  }

  // If no items, show a default map
  if (items.length === 0) {
    return (
      <div className="w-full h-full bg-slate-100 dark:bg-slate-900 transition-colors relative">
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={center}
            zoom={8}
            onLoad={onLoad}
            onUnmount={onUnmount}
            options={{
              disableDefaultUI: false,
              zoomControl: true,
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        )}
        {!isModalOpen && <WeatherWidget city="Taipei" />}
      </div>
    );
  }

  const selectedIndex = selectedItemId ? items.findIndex(i => i.id === selectedItemId) : -1;
  
  // Prepare directions request
  let origin = "";
  let destination = "";
  let waypoints: google.maps.DirectionsWaypoint[] = [];

  if (selectedIndex === 0 || items.length === 1) {
    // Single point, no route
  } else if (selectedIndex > 0) {
    origin = items[selectedIndex - 1].place_name;
    destination = items[selectedIndex].place_name;
  } else {
    origin = items[0].place_name;
    destination = items[items.length - 1].place_name;
    if (items.length > 2) {
      waypoints = items.slice(1, -1).map(item => ({
        location: item.place_name,
        stopover: true
      }));
    }
  }

  return (
    <div className="w-full h-full bg-slate-100 dark:bg-slate-900 transition-colors relative">
      {isLoaded ? (
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={center}
          zoom={8}
          onLoad={onLoad}
          onUnmount={onUnmount}
          options={{
            disableDefaultUI: false,
            zoomControl: true,
          }}
        >
          {origin && destination && !response && (
            <DirectionsService
              options={{
                destination: destination,
                origin: origin,
                waypoints: waypoints,
                travelMode: travelMode as google.maps.TravelMode,
                provideRouteAlternatives: true
              }}
              callback={directionsCallback}
            />
          )}

          {response && (
            <DirectionsRenderer
              options={{
                directions: response,
                routeIndex: routeIndex
              }}
            />
          )}
        </GoogleMap>
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      )}

      {/* Directions Error Overlay */}
      {errorStatus === 'REQUEST_DENIED' && (
        <div className="absolute inset-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6 text-center">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-2xl max-w-sm border border-amber-200 dark:border-amber-900/30">
            <h4 className="text-lg font-bold text-slate-800 dark:text-white mb-2">無法規劃路徑</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Google 拒絕了路徑請求。這通常是因為您的 API 金鑰尚未啟用 <strong>Directions API</strong>。
            </p>
            <div className="flex flex-col gap-2">
              <a 
                href="https://console.cloud.google.com/apis/library/directions-backend.googleapis.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                立即啟用 Directions API
              </a>
              <button 
                onClick={() => setErrorStatus(null)}
                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                暫時關閉
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Route Selector Info - Bottom Left */}
      {response && response.routes.length > 1 && (
        <div className="absolute bottom-20 left-4 z-20 bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 max-w-[200px]">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">選擇路線</p>
          <div className="flex flex-col gap-2">
            {response.routes.map((route, idx) => (
              <button
                key={idx}
                onClick={() => setRouteIndex(idx)}
                className={`text-left px-2 py-1.5 rounded text-xs transition-colors ${
                  routeIndex === idx 
                    ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800' 
                    : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="font-semibold">{route.summary || `路線 ${idx + 1}`}</div>
                <div className="opacity-70">{route.legs[0].distance?.text} • {route.legs[0].duration?.text}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Travel Mode Selector - Top Right */}
      {onTravelModeChange && (
        <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
          <div className="bg-white dark:bg-slate-800 p-1 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row gap-1">
            <button
              onClick={() => onTravelModeChange('DRIVING')}
              className={`p-2 rounded-md transition-colors flex items-center gap-2 ${
                travelMode === 'DRIVING' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
              title="開車"
            >
              <Car className="w-4 h-4" />
              <span className="text-xs font-medium hidden lg:block">開車</span>
            </button>
            <button
              onClick={() => onTravelModeChange('TRANSIT')}
              className={`p-2 rounded-md transition-colors flex items-center gap-2 ${
                travelMode === 'TRANSIT' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
              title="大眾運輸"
            >
              <Train className="w-4 h-4" />
              <span className="text-xs font-medium hidden lg:block">大眾運輸</span>
            </button>
            <button
              onClick={() => onTravelModeChange('BICYCLING')}
              className={`p-2 rounded-md transition-colors flex items-center gap-2 ${
                travelMode === 'BICYCLING' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
              title="自行車"
            >
              <Bike className="w-4 h-4" />
              <span className="text-xs font-medium hidden lg:block">自行車</span>
            </button>
            <button
              onClick={() => onTravelModeChange('WALKING')}
              className={`p-2 rounded-md transition-colors flex items-center gap-2 ${
                travelMode === 'WALKING' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
              title="步行"
            >
              <Footprints className="w-4 h-4" />
              <span className="text-xs font-medium hidden lg:block">步行</span>
            </button>
          </div>
        </div>
      )}

      {!isModalOpen && <WeatherWidget city={getTargetCity()} />}
    </div>
  );
}
