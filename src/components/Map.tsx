import WeatherWidget from './WeatherWidget';
import { Car, Train, Bike, Footprints, ArrowRight, AlertTriangle, X, Loader2, Image as ImageIcon } from 'lucide-react';
import React, { useState, useEffect } from 'react';

interface MapProps {
  items: any[];
  travelMode: string;
  onTravelModeChange?: (mode: string) => void;
  selectedItemId?: string | null;
  isModalOpen?: boolean;
}

export default function MapView({ items, travelMode, onTravelModeChange, selectedItemId, isModalOpen }: MapProps) {
  const isMultiPointTransit = !selectedItemId && items.length > 2 && travelMode === 'TRANSIT';
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState<string | null>(null);
  const [isLoadingPhoto, setIsLoadingPhoto] = useState(false);

  const getMapUrl = () => {
    if (items.length === 0) {
      return "https://maps.google.com/maps?q=Taiwan&output=embed";
    }
    
    let dirflg = 'd';
    if (travelMode === 'TRANSIT') dirflg = 'r';
    else if (travelMode === 'WALKING') dirflg = 'w';
    else if (travelMode === 'BICYCLING') dirflg = 'b';

    // Google Maps embed does not support multiple destinations for transit
    if (isMultiPointTransit) {
      dirflg = 'd';
    }

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

  const displayItem = selectedItemId ? items.find(i => i.id === selectedItemId) : items.length > 0 ? items[0] : null;

  // Fetch image from Wikimedia API
  useEffect(() => {
    if (!displayItem) {
      setCurrentPhotoUrl(null);
      return;
    }

    const fetchWikiImage = async () => {
      setIsLoadingPhoto(true);
      try {
        const searchTerm = displayItem.place_name.split(' ')[0];
        const url = `https://zh.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=pageimages&piprop=thumbnail&pithumbsize=800&generator=search&gsrsearch=${encodeURIComponent(searchTerm)}&gsrlimit=1`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.query && data.query.pages) {
          const pages = data.query.pages;
          const pageId = Object.keys(pages)[0];
          const thumbnail = pages[pageId].thumbnail;
          
          if (thumbnail && thumbnail.source) {
            setCurrentPhotoUrl(thumbnail.source);
          } else {
            const enUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=pageimages&piprop=thumbnail&pithumbsize=800&generator=search&gsrsearch=${encodeURIComponent(searchTerm)}&gsrlimit=1`;
            const enResponse = await fetch(enUrl);
            const enData = await enResponse.json();
            
            if (enData.query && enData.query.pages) {
              const enPages = enData.query.pages;
              const enPageId = Object.keys(enPages)[0];
              const enThumbnail = enPages[enPageId].thumbnail;
              if (enThumbnail && enThumbnail.source) {
                setCurrentPhotoUrl(enThumbnail.source);
              } else {
                setCurrentPhotoUrl('https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80');
              }
            } else {
              setCurrentPhotoUrl('https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80');
            }
          }
        } else {
          setCurrentPhotoUrl('https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80');
        }
      } catch (error) {
        console.error('Error fetching wiki image:', error);
        setCurrentPhotoUrl('https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80');
      } finally {
        setIsLoadingPhoto(false);
      }
    };

    fetchWikiImage();
  }, [displayItem?.place_name]);

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
          
          {/* Warning for multi-point transit */}
          {isMultiPointTransit && (
            <div className="bg-amber-50 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-700/50 text-amber-800 dark:text-amber-200 p-2.5 rounded-lg shadow-lg max-w-[240px] flex items-start gap-2 animate-fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <p className="text-xs leading-relaxed">
                Google地圖不支援「多點」大眾運輸，總覽已切換為開車路線。請點擊左側<strong>單一景點</strong>查看大眾運輸路線。
              </p>
            </div>
          )}
        </div>
      )}

      {/* Bottom Overlays Container */}
      {!isModalOpen && (
        <>
          {/* Weather Widget - Positioned to cover Google Maps controls */}
          <WeatherWidget 
            city={getTargetCity()} 
            className="absolute bottom-2 left-2 z-30" 
          />

          <div className="absolute bottom-20 sm:bottom-6 left-4 right-4 z-20 flex items-end justify-between pointer-events-none">
            
            {/* Left Side: Route Sequence */}
            <div className="flex items-end gap-3 flex-1 min-w-0 justify-start pl-24">
              {/* Route Sequence Overlay */}
              {items.length > 1 && (
                <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md px-4 py-0 rounded-xl shadow-xl border border-slate-200/50 dark:border-slate-700/50 flex items-center gap-2 overflow-x-auto whitespace-nowrap hide-scrollbar pointer-events-auto h-16 flex-1 max-w-3xl">
                  {items.map((item, index) => {
                    const isSelected = selectedItemId === item.id;
                    const isPrev = selectedItemId && items.findIndex(i => i.id === selectedItemId) - 1 === index;
                    const isFullRoute = !selectedItemId;
                    const showItem = isFullRoute || isSelected || isPrev;

                    if (!showItem) return null;

                    return (
                      <React.Fragment key={item.id}>
                        <div className={`flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-lg transition-colors ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''}`}>
                          <span className={`flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
                            isSelected || isFullRoute ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-200'
                          }`}>
                            {index + 1}
                          </span>
                          <span className={`text-sm ${isSelected ? 'font-bold text-indigo-700 dark:text-indigo-300' : 'font-medium text-slate-700 dark:text-slate-200'}`}>
                            {item.place_name}
                          </span>
                        </div>
                        {((isFullRoute && index < items.length - 1) || isPrev) ? (
                          <div className="text-slate-400 dark:text-slate-500 shrink-0 flex items-center">
                            <ArrowRight className="w-4 h-4" />
                          </div>
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Side: Place Photo (Real Wikimedia Image) */}
            {displayItem && (
              <div className="shrink-0 ml-3 pointer-events-auto group relative hidden sm:block">
                <div 
                  className="w-16 h-16 bg-white p-1 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 transform transition-transform group-hover:scale-110 group-hover:-rotate-2 origin-bottom-right cursor-pointer flex items-center justify-center overflow-hidden"
                  onClick={() => setIsPhotoModalOpen(true)}
                >
                {isLoadingPhoto ? (
                  <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                ) : currentPhotoUrl ? (
                  <img 
                    src={currentPhotoUrl} 
                    alt={displayItem.place_name}
                    className="w-full h-full object-cover rounded-lg"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <ImageIcon className="w-6 h-6 text-slate-300" />
                )}
                <div className="absolute -bottom-2 -left-2 bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-md max-w-[120px] truncate">
                  {displayItem.place_name}
                </div>
              </div>
            </div>
          )}
        </div>
      </>
    )}

    {/* Photo Modal Overlay */}
      {isPhotoModalOpen && displayItem && currentPhotoUrl && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setIsPhotoModalOpen(false)}
        >
          <div 
            className="relative max-w-5xl w-full max-h-[90vh] flex flex-col items-center justify-center animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <button 
              onClick={() => setIsPhotoModalOpen(false)}
              className="absolute -top-12 right-0 sm:-right-12 text-white/70 hover:text-white p-2 transition-colors bg-black/20 hover:bg-black/40 rounded-full backdrop-blur-md"
            >
              <X className="w-8 h-8" />
            </button>
            <img 
              src={currentPhotoUrl} 
              alt={displayItem.place_name}
              className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl border-4 border-white/10"
              referrerPolicy="no-referrer"
            />
            <div className="mt-4 text-white text-lg sm:text-xl font-bold bg-black/50 px-6 py-2.5 rounded-full backdrop-blur-md shadow-lg border border-white/10">
              {displayItem.place_name}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
