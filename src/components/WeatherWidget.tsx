import { CloudSun, ExternalLink } from 'lucide-react';

export default function WeatherWidget({ city }: { city: string }) {
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(city + ' 天氣')}`;

  return (
    <a 
      href={searchUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="absolute bottom-4 left-4 bg-white/90 dark:bg-slate-800/90 p-2 rounded-xl shadow-lg backdrop-blur-md z-10 border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-1 hover:bg-white dark:hover:bg-slate-800 transition-all group hover:scale-105 active:scale-95 w-16 h-16"
    >
      <CloudSun className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
      <div className="flex flex-col items-center w-full overflow-hidden">
        <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 leading-none mb-0.5">天氣 :</span>
        <span className="text-[9px] font-semibold text-slate-900 dark:text-white truncate w-full text-center px-0.5">{city}</span>
      </div>
    </a>
  );
}
