import { CloudSun, ExternalLink } from 'lucide-react';

export default function WeatherWidget({ city }: { city: string }) {
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(city + ' 天氣')}`;

  return (
    <a 
      href={searchUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="absolute bottom-4 left-4 bg-white/90 dark:bg-slate-800/90 p-3 rounded-xl shadow-lg backdrop-blur-md z-10 border border-slate-200 dark:border-slate-700 flex items-center gap-3 hover:bg-white dark:hover:bg-slate-800 transition-all group group-hover:scale-105 active:scale-95"
    >
      <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg flex items-center justify-center text-indigo-600 dark:text-indigo-400">
        <CloudSun className="w-6 h-6" />
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">查看天氣</span>
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold text-slate-900 dark:text-white truncate max-w-[100px]">{city}</span>
          <ExternalLink className="w-3 h-3 text-slate-400" />
        </div>
      </div>
    </a>
  );
}
