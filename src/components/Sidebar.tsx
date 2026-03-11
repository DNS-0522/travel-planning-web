import * as React from 'react';
import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult, DraggableProvided, DraggableStateSnapshot } from '@hello-pangea/dnd';
import { GripVertical, Trash2, MapPin, Clock, Calendar, Plus, X, Edit2, Check, ChevronDown } from 'lucide-react';

interface SidebarProps {
  selectedTrip: any;
  items: any[];
  onAddItem: (item: any) => void;
  onDeleteItem: (id: string) => void;
  onReorder: (items: any[]) => void;
  travelMode: string;
  onTravelModeChange: (mode: string) => void;
  selectedItemId: string | null;
  onSelectItem: (id: string) => void;
  tripDays: any[];
  onUpdateTripDays: (days: any[]) => void;
  onUpdateItem: (id: string, updates: any) => void;
  selectedDayId: string | null;
  setSelectedDayId: (id: string | null) => void;
}

const TimeSelector = ({ value, onChange, className }: { value: string, onChange: (val: string) => void, className?: string }) => {
  const [h, m] = (value || "08:00").split(':');
  
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

  const handleHourChange = (newH: string) => onChange(`${newH}:${m || '00'}`);
  const handleMinuteChange = (newM: string) => onChange(`${h || '08'}:${newM}`);

  return (
    <div className={`flex items-center gap-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md px-2 py-1.5 ${className}`}>
      <select 
        value={h || '08'} 
        onChange={(e) => handleHourChange(e.target.value)}
        className="bg-transparent border-none focus:ring-0 p-0 text-sm text-slate-900 dark:text-white cursor-pointer appearance-none outline-none"
      >
        {hours.map(hour => <option key={hour} value={hour} className="bg-white dark:bg-slate-800">{hour}</option>)}
      </select>
      <span className="text-slate-400 text-xs">:</span>
      <select 
        value={m || '00'} 
        onChange={(e) => handleMinuteChange(e.target.value)}
        className="bg-transparent border-none focus:ring-0 p-0 text-sm text-slate-900 dark:text-white cursor-pointer appearance-none outline-none"
      >
        {minutes.map(min => <option key={min} value={min} className="bg-white dark:bg-slate-800">{min}</option>)}
      </select>
      <ChevronDown className="w-3 h-3 text-slate-400 ml-1" />
    </div>
  );
};

export default function Sidebar({
  selectedTrip,
  items,
  onAddItem,
  onDeleteItem,
  onReorder,
  travelMode,
  onTravelModeChange,
  selectedItemId,
  onSelectItem,
  tripDays,
  onUpdateTripDays,
  onUpdateItem,
  selectedDayId,
  setSelectedDayId,
}: SidebarProps) {
  const [stayDuration, setStayDuration] = useState('');
  const [travelTime, setTravelTime] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editStayDuration, setEditStayDuration] = useState('');
  const [editTravelTime, setEditTravelTime] = useState('');

  const calculateEndTime = (startTime: string, durationMinutes: string) => {
    if (!startTime || !durationMinutes) return null;
    const [hours, minutes] = startTime.split(':').map(Number);
    const duration = parseInt(durationMinutes, 10);
    if (isNaN(hours) || isNaN(minutes) || isNaN(duration)) return null;
    
    const date = new Date();
    date.setHours(hours, minutes + duration, 0);
    
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const roundToNearest5 = (timeStr: string) => {
    if (!timeStr) return timeStr;
    const [hours, minutes] = timeStr.split(':');
    if (!hours || !minutes) return timeStr;
    
    const mins = parseInt(minutes, 10);
    const roundedMins = Math.round(mins / 5) * 5;
    
    let h = parseInt(hours, 10);
    let m = roundedMins;
    if (m === 60) {
      m = 0;
      h = (h + 1) % 24;
    }
    
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  // When tripDays change, if selectedDayId is no longer valid or null, set it to the first day
  useEffect(() => {
    if (tripDays.length > 0) {
      if (!selectedDayId || !tripDays.find(d => d.id === selectedDayId)) {
        setSelectedDayId(tripDays[0].id);
      }
    } else {
      setSelectedDayId(null);
    }
  }, [tripDays, selectedDayId]);

  const handlePlaceAdd = () => {
    if (inputValue.trim()) {
      onAddItem({
        trip_id: selectedTrip.id,
        place_name: inputValue.trim(),
        lat: 0,
        lng: 0,
        order_index: items.length,
        stay_duration: stayDuration,
        travel_time: travelTime,
        day_id: selectedDayId,
      });
      setInputValue('');
      setStayDuration('');
      setTravelTime('');
    }
  };

  const filteredItems = selectedDayId 
    ? items.filter(item => item.day_id === selectedDayId)
    : items;

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;
    if (sourceIndex === destinationIndex) return;

    if (result.type === 'DAY') {
      const newDays = Array.from(tripDays);
      const [reorderedDay] = newDays.splice(sourceIndex, 1);
      newDays.splice(destinationIndex, 0, reorderedDay);
      onUpdateTripDays(newDays);
      return;
    }

    const newItems = Array.from(items);
    
    if (selectedDayId) {
      const sourceItem = filteredItems[sourceIndex];
      const destItem = filteredItems[destinationIndex];
      
      const actualSourceIndex = newItems.findIndex(i => i.id === sourceItem.id);
      const actualDestIndex = newItems.findIndex(i => i.id === destItem.id);
      
      const [reorderedItem] = newItems.splice(actualSourceIndex, 1);
      reorderedItem.day_id = destItem.day_id;
      newItems.splice(actualDestIndex, 0, reorderedItem);
    } else {
      const [reorderedItem] = newItems.splice(sourceIndex, 1);
      newItems.splice(destinationIndex, 0, reorderedItem);
    }

    onReorder(newItems);
  };

  const startEditing = (item: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingItemId(item.id);
    setEditStayDuration(item.stay_duration || '');
    setEditTravelTime(item.travel_time || '');
  };

  const saveEditing = (item: any, e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateItem(item.id, {
      stay_duration: editStayDuration,
      travel_time: editTravelTime,
      day_id: item.day_id,
    });
    setEditingItemId(null);
  };

  return (
    <div className="w-full sm:w-96 bg-white dark:bg-black border-r border-slate-200 dark:border-slate-800 flex flex-col h-full z-10 shadow-lg transition-colors">
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">新增行程</h2>
          
          {/* Days Navigation */}
          <Droppable droppableId="days-nav" direction="horizontal" type="DAY">
            {(provided) => (
              <div 
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="flex items-center gap-2 mb-4 overflow-x-auto pb-2 scrollbar-thin"
              >
                {tripDays.map((day, index) => (
                  // @ts-ignore
                  <Draggable key={day.id} draggableId={day.id} index={index}>
                    {(provided, snapshot) => (
                      <div 
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`flex items-center gap-1 p-1 rounded-full transition-all border ${
                          snapshot.isDragging 
                            ? 'bg-indigo-100 dark:bg-indigo-900/50 border-indigo-500 shadow-md scale-105 z-50' 
                            : 'border-transparent'
                        }`}
                      >
                        <div
                          {...provided.dragHandleProps}
                          className="text-slate-400 hover:text-indigo-500 cursor-grab active:cursor-grabbing px-1"
                        >
                          <GripVertical className="w-3 h-3" />
                        </div>
                        <button
                          onClick={() => setSelectedDayId(day.id)}
                          className={`px-3 py-1 text-sm rounded-full whitespace-nowrap transition-colors ${
                            selectedDayId === day.id 
                              ? 'bg-indigo-600 text-white' 
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                          }`}
                        >
                          Day {index + 1}
                        </button>
                        {tripDays.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const newDays = tripDays.filter(d => d.id !== day.id);
                              onUpdateTripDays(newDays);
                              items.filter(i => i.day_id === day.id).forEach(i => {
                                onDeleteItem(i.id);
                              });
                            }}
                            className="text-slate-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                            title="刪除天數"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
                <button
                  onClick={() => {
                    const newDay = { id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, name: `Day ${tripDays.length + 1}` };
                    onUpdateTripDays([...tripDays, newDay]);
                    setSelectedDayId(newDay.id);
                  }}
                  className="px-3 py-1 text-sm rounded-full whitespace-nowrap bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 flex items-center gap-1 transition-colors flex-shrink-0"
                >
                  <Plus className="w-3 h-3" /> 新增天數
                </button>
              </div>
            )}
          </Droppable>

        <div className="space-y-3">
          <div className="relative">
            <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="輸入地點名稱 (例: 東京車站)"
              className="w-full pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handlePlaceAdd();
                }
              }}
            />
          </div>
          
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Clock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="number"
                step="5"
                placeholder="停留時間 (分鐘)"
                className="w-full pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                value={stayDuration}
                onChange={(e) => setStayDuration(e.target.value)}
              />
            </div>
            <div className="relative flex-1">
              <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 z-10" />
              <TimeSelector 
                value={travelTime} 
                onChange={(val) => setTravelTime(val)} 
                className="pl-9 h-[38px]"
              />
            </div>
          </div>
          
          <button
            onClick={handlePlaceAdd}
            disabled={!inputValue.trim()}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> 加入行程
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50 dark:bg-black">
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">
            {selectedDayId ? `Day ${tripDays.findIndex(d => d.id === selectedDayId) + 1} 行程列表` : '所有行程列表'}
          </h3>
          {filteredItems.length === 0 ? (
            <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
              尚未加入任何行程
            </div>
          ) : (
            <Droppable droppableId="itinerary-list">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="space-y-3"
                >
                  {filteredItems.map((item, index) => (
                    // @ts-ignore
                    <Draggable key={String(item.id)} draggableId={String(item.id)} index={index}>
                      {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          onClick={() => onSelectItem(item.id)}
                          className={`bg-white dark:bg-slate-800 border rounded-lg shadow-sm p-3 flex items-start gap-3 transition-colors cursor-pointer ${
                            snapshot.isDragging 
                              ? 'border-indigo-500 shadow-md ring-1 ring-indigo-500' 
                              : selectedItemId === item.id 
                                ? 'border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-900 bg-indigo-50/30 dark:bg-indigo-900/10' 
                                : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                          }`}
                        >
                          <div
                            {...provided.dragHandleProps}
                            className="mt-1 text-slate-400 dark:text-slate-500 hover:text-indigo-500 cursor-grab active:cursor-grabbing"
                          >
                            <GripVertical className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-slate-900 dark:text-slate-100 truncate" title={item.place_name}>
                              {index + 1}. {item.place_name}
                              {!selectedDayId && item.day_id && tripDays.findIndex(d => d.id === item.day_id) !== -1 && (
                                <span className="ml-2 text-xs text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded">
                                  Day {tripDays.findIndex(d => d.id === item.day_id) + 1}
                                </span>
                              )}
                            </h4>
                            
                            {editingItemId === item.id ? (
                              <div className="mt-2 space-y-2" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-slate-400" />
                                  <input
                                    type="number"
                                    step="5"
                                    placeholder="停留時間 (分鐘)"
                                    className="flex-1 px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    value={editStayDuration}
                                    onChange={(e) => setEditStayDuration(e.target.value)}
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-slate-400" />
                                  <TimeSelector 
                                    value={editTravelTime} 
                                    onChange={(val) => setEditTravelTime(val)} 
                                    className="flex-1 py-0.5 px-1.5 h-7"
                                  />
                                </div>
                                <div className="flex justify-end gap-2 mt-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingItemId(null);
                                    }}
                                    className="px-2 py-1 text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded hover:bg-slate-200 dark:hover:bg-slate-600"
                                  >
                                    取消
                                  </button>
                                  <button
                                    onClick={(e) => saveEditing(item, e)}
                                    className="px-2 py-1 text-xs text-white bg-indigo-600 rounded hover:bg-indigo-700 flex items-center gap-1"
                                  >
                                    <Check className="w-3 h-3" /> 儲存
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                                {item.travel_time && (
                                  <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                                    <Clock className="w-3 h-3" /> {item.travel_time}
                                    {item.stay_duration && (
                                      <>
                                        <span className="mx-1">-</span>
                                        {calculateEndTime(item.travel_time, item.stay_duration)}
                                      </>
                                    )}
                                  </span>
                                )}
                                {item.stay_duration && (
                                  <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                                    停留 {item.stay_duration} 分鐘
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          
                          {editingItemId !== item.id && (
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={(e) => startEditing(item, e)}
                                className="text-slate-400 dark:text-slate-500 hover:text-indigo-500 p-1 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                                title="編輯時間"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteItem(item.id);
                                }}
                                className="text-slate-400 dark:text-slate-500 hover:text-red-500 p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                title="刪除"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          )}
        </div>
      </DragDropContext>
    </div>
  );
}
