import WeatherWidget from './WeatherWidget';
import { Car, Train, Bike, Footprints } from 'lucide-react';

interface MapProps {
  items: any[];
  travelMode: string;
  onTravelModeChange?: (mode: string) => void;
  selectedItemId?: string | null;
  isModalOpen?: boolean;
}

export default function MapView({ items, travelMode, onTravelModeChange, selectedItemId, isModalOpen }: MapProps) {
  const getMapUrl = () => {
    if (items.length === 0) {
      return "https://maps.google.com/maps?q=Taiwan&output=embed";
    }
    
    let dirflg = 'd';
    if (travelMode === 'TRANSIT') dirflg = 'r';
    else if (travelMode === 'WALKING') dirflg = 'w';
    else if (travelMode === 'BICYCLING') dirflg = 'b';

    const selectedIndex = selectedItemId ? items.findIndex(i => i.id === selectedItemId) : -1;
    const baseParams = `&hl=zh-TW&ie=UTF8&output=embed`;

    // Embed URL logic
    if (selectedIndex === 0) {
      const place = encodeURIComponent(items[0].place_name);
      return `https://maps.google.com/maps?q=${place}${baseParams}`;
    } 
    else if (selectedIndex > 0) {
      const origin = encodeURIComponent(items[selectedIndex - 1].place_name);
      const destination = encodeURIComponent(items[selectedIndex].place_name);
      return `https://maps.google.com/maps?saddr=${origin}&daddr=${destination}&dirflg=${dirflg}${baseParams}`;
    }

    if (items.length === 1) {
      const place = encodeURIComponent(items[0].place_name);
      return `https://maps.google.com/maps?q=${place}${baseParams}`;
    }
    
    const origin = encodeURIComponent(items[0].place_name);
    const destinations = items.slice(1).map(item => encodeURIComponent(item.place_name)).join('+to:');

    return `https://maps.google.com/maps?saddr=${origin}&daddr=${destinations}&dirflg=${dirflg}${baseParams}`;
  };

  const getTargetCity = () => {
    const selectedItem = items.find(i => i.id === selectedItemId);
    if (selectedItem) return selectedItem.place_name;
    if (items.length > 0) return items[0].place_name;
    return "Taipei";
  };

  return (
    <div className="w-full h-full bg-slate-100 dark:bg-slate-900 transition-colors relative">
      <iframe
        width="100%"
        height="100%"
        style={{ border: 0 }}
        loading="lazy"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
        src={getMapUrl()}
      ></iframe>
      
      {/* Travel Mode Selector - Top Right */}
      {onTravelModeChange && (
        <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 items-end">
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
