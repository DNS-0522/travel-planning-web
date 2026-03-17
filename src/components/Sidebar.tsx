import * as React from 'react';
import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult, DraggableProvided, DraggableStateSnapshot } from '@hello-pangea/dnd';
import { GripVertical, Trash2, MapPin, Clock, Calendar, Plus, X, Edit2, Check, ChevronDown, FileText, Wallet, Banknote, User, Image as ImageIcon, Loader2, Zap, AlertTriangle } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

interface SidebarProps {
  selectedTrip: any;
  items: any[];
  onAddItem: (item: any) => void;
  onDeleteItem: (id: string) => void;
  onReorder: (items: any[]) => void;
  travelMode: string;
  onTravelModeChange: (mode: string) => void;
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
  tripDays: any[];
  onUpdateTripDays: (days: any[]) => void;
  onUpdateItem: (id: string, updates: any) => void;
  selectedDayId: string | null;
  setSelectedDayId: (id: string | null) => void;
  expenses: any[];
  onAddExpense: (expense: any) => void;
  onDeleteExpense: (id: string) => void;
  onUpdateExpense: (id: string, updates: any) => void;
  onReorderExpenses: (expenses: any[]) => void;
  packingItems: any[];
  onAddPackingItem: (item: any) => void;
  onDeletePackingItem: (id: string) => void;
  onUpdatePackingItem: (id: string, updates: any) => void;
  onReorderPackingItems: (items: any[]) => void;
  activeTab: 'itinerary' | 'expenses' | 'packing';
  setActiveTab: (tab: 'itinerary' | 'expenses' | 'packing') => void;
  onExportICS?: () => void;
}

const TimeSelector = ({ value, onChange, className }: { value: string, onChange: (val: string) => void, className?: string }) => {
  const [h, m] = value ? value.split(':') : ['', ''];
  
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

  const handleHourChange = (newH: string) => onChange(`${newH}:${m || '00'}`);
  const handleMinuteChange = (newM: string) => onChange(`${h || '08'}:${newM}`);

  return (
    <div className={`flex items-center gap-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md px-2 py-1.5 ${className}`}>
      <select 
        value={h} 
        onChange={(e) => handleHourChange(e.target.value)}
        className="bg-transparent border-none focus:ring-0 p-0 text-sm text-slate-900 dark:text-white cursor-pointer appearance-none outline-none"
      >
        <option value="" disabled>--</option>
        {hours.map(hour => <option key={hour} value={hour} className="bg-white dark:bg-slate-800">{hour}</option>)}
      </select>
      <span className="text-slate-400 text-xs">:</span>
      <select 
        value={m} 
        onChange={(e) => handleMinuteChange(e.target.value)}
        className="bg-transparent border-none focus:ring-0 p-0 text-sm text-slate-900 dark:text-white cursor-pointer appearance-none outline-none"
      >
        <option value="" disabled>--</option>
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
  expenses,
  onAddExpense,
  onDeleteExpense,
  onUpdateExpense,
  onReorderExpenses,
  packingItems,
  onAddPackingItem,
  onDeletePackingItem,
  onUpdatePackingItem,
  onReorderPackingItems,
  activeTab,
  setActiveTab,
  onExportICS,
}: SidebarProps) {
  const [stayDuration, setStayDuration] = useState('');
  const [travelTime, setTravelTime] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editStayDuration, setEditStayDuration] = useState('');
  const [editTravelTime, setEditTravelTime] = useState('');
  const [editPlaceName, setEditPlaceName] = useState('');
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [noteEditingItem, setNoteEditingItem] = useState<any>(null);
  const [noteText, setNoteText] = useState('');
  const [noteImages, setNoteImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Load from localStorage when trip changes
  useEffect(() => {
    if (selectedTrip?.id) {
      const saved = localStorage.getItem(`expandedCategories_${selectedTrip.id}`);
      if (saved) {
        try {
          setExpandedCategories(JSON.parse(saved));
        } catch (e) {
          setExpandedCategories([]);
        }
      } else {
        // Default all categories to collapsed (empty expanded list)
        setExpandedCategories([]);
      }
    }
  }, [selectedTrip?.id]);

  // Save to localStorage when state changes
  useEffect(() => {
    if (selectedTrip?.id) {
      localStorage.setItem(`expandedCategories_${selectedTrip.id}`, JSON.stringify(expandedCategories));
    }
  }, [expandedCategories, selectedTrip?.id]);

  // Expense states
  const [expenseItemName, setExpenseItemName] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expensePayer, setExpensePayer] = useState('');
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editExpenseItemName, setEditExpenseItemName] = useState('');
  const [editExpenseAmount, setEditExpenseAmount] = useState('');
  const [editExpensePayer, setEditExpensePayer] = useState('');

  // Packing list states
  const [packingItemName, setPackingItemName] = useState('');
  const [packingItemQuantity, setPackingItemQuantity] = useState('1');
  const [packingItemCategory, setPackingItemCategory] = useState('');
  const [editingPackingId, setEditingPackingId] = useState<string | null>(null);
  const [timeWarning, setTimeWarning] = useState<string | null>(null);
  const [editPackingItemName, setEditPackingItemName] = useState('');
  const [editPackingItemQuantity, setEditPackingItemQuantity] = useState('');
  const [editPackingItemCategory, setEditPackingItemCategory] = useState('');

  const calculateEndTime = (startTime: string, durationMinutes: string) => {
    if (!startTime || !durationMinutes) return null;
    const [hours, minutes] = startTime.split(':').map(Number);
    const duration = parseInt(durationMinutes, 10);
    if (isNaN(hours) || isNaN(minutes) || isNaN(duration)) return null;
    
    const date = new Date();
    date.setHours(hours, minutes + duration, 0);
    
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    
    return `${h}:${m}`;
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

  const handleAutoSchedule = () => {
    if (!selectedDayId || filteredItems.length < 2) return;
    
    // Use the current array order (visual order) instead of sorting by order_index
    // because order_index might be stale during a reorder operation.
    const dayItems = [...filteredItems];
    
    // Start with the first item's time or default to 08:00
    let lastTime = dayItems[0].travel_time || '08:00';
    
    // Create a map for quick lookup of updated times
    const timeUpdates: Record<string, string> = {};
    
    for (let i = 1; i < dayItems.length; i++) {
      const prevItem = dayItems[i-1];
      // Use the updated time for the previous item if we just calculated it
      const startTime = i === 1 ? lastTime : timeUpdates[prevItem.id];
      
      // Use 0 if duration is not set, instead of defaulting to 60
      const duration = parseInt(prevItem.stay_duration, 10) || 0;
      
      const [h, m] = startTime.split(':').map(Number);
      const date = new Date();
      date.setHours(h, m + duration, 0);
      
      // Round to nearest 5 minutes for a cleaner schedule
      const mins = date.getMinutes();
      const roundedMins = Math.round(mins / 5) * 5;
      date.setMinutes(roundedMins);
      
      const nextTime = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
      timeUpdates[dayItems[i].id] = nextTime;
    }
    
    // Apply updates to the full items list
    const updatedItems = items.map(item => {
      if (timeUpdates[item.id]) {
        return { ...item, travel_time: timeUpdates[item.id] };
      }
      return item;
    });
    
    onReorder(updatedItems);
  };

  const handlePlaceAdd = () => {
    if (inputValue.trim()) {
      // Time validation check
      if (selectedDayId && filteredItems.length > 0 && travelTime) {
        const dayItems = [...filteredItems].sort((a, b) => a.order_index - b.order_index);
        const lastItem = dayItems[dayItems.length - 1];
        
        if (lastItem.travel_time && lastItem.stay_duration) {
          const [lastH, lastM] = lastItem.travel_time.split(':').map(Number);
          const lastDuration = parseInt(lastItem.stay_duration, 10) || 0;
          const lastEndTime = new Date();
          lastEndTime.setHours(lastH, lastM + lastDuration, 0);
          
          const [newH, newM] = travelTime.split(':').map(Number);
          const newStartTime = new Date();
          newStartTime.setHours(newH, newM, 0);
          
          if (newStartTime < lastEndTime) {
            const endTimeStr = `${String(lastEndTime.getHours()).padStart(2, '0')}:${String(lastEndTime.getMinutes()).padStart(2, '0')}`;
            const warningMsg = `時間衝突：開始時間 (${travelTime}) 早於上一個行程的結束時間 (${endTimeStr})`;
            
            if (timeWarning !== warningMsg) {
              setTimeWarning(warningMsg);
              return; // Stop and show warning
            }
          }
        }
      }

      onAddItem({
        trip_id: selectedTrip.id,
        place_name: inputValue.trim(),
        lat: 0,
        lng: 0,
        order_index: items.length,
        stay_duration: stayDuration,
        travel_time: travelTime,
        day_id: selectedDayId,
        notes: '',
      });
      setInputValue('');
      setStayDuration('');
      setTravelTime('');
      setTimeWarning(null);
    }
  };

  const handleExpenseAdd = () => {
    if (expenseItemName.trim() && expenseAmount && expensePayer.trim()) {
      onAddExpense({
        trip_id: selectedTrip.id,
        day_id: selectedDayId,
        item_name: expenseItemName.trim(),
        amount: parseFloat(expenseAmount),
        payer: expensePayer.trim(),
        order_index: expenses.length,
      });
      setExpenseItemName('');
      setExpenseAmount('');
      setExpensePayer('');
    }
  };

  const filteredItems = selectedDayId 
    ? items.filter(item => item.day_id === selectedDayId)
    : items;

  const filteredExpenses = selectedDayId
    ? expenses.filter(exp => exp.day_id === selectedDayId)
    : expenses;

  const hasConflict = (index: number) => {
    if (index === 0 || activeTab !== 'itinerary') return false;
    const prevItem = filteredItems[index - 1];
    const currentItem = filteredItems[index];
    
    if (!prevItem.travel_time || !prevItem.stay_duration || !currentItem.travel_time) return false;
    
    const [prevH, prevM] = prevItem.travel_time.split(':').map(Number);
    const prevDuration = parseInt(prevItem.stay_duration, 10) || 0;
    const prevEndTime = new Date();
    prevEndTime.setHours(prevH, prevM + prevDuration, 0);
    
    const [currH, currM] = currentItem.travel_time.split(':').map(Number);
    const currStartTime = new Date();
    currStartTime.setHours(currH, currM, 0);
    
    return currStartTime < prevEndTime;
  };

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

    if (activeTab === 'itinerary') {
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
    } else if (activeTab === 'expenses') {
      const newExpenses = Array.from(expenses);
      
      if (selectedDayId) {
        const sourceExp = filteredExpenses[sourceIndex];
        const destExp = filteredExpenses[destinationIndex];
        
        const actualSourceIndex = newExpenses.findIndex(i => i.id === sourceExp.id);
        const actualDestIndex = newExpenses.findIndex(i => i.id === destExp.id);
        
        const [reorderedExp] = newExpenses.splice(actualSourceIndex, 1);
        reorderedExp.day_id = destExp.day_id;
        newExpenses.splice(actualDestIndex, 0, reorderedExp);
      } else {
        const [reorderedExp] = newExpenses.splice(sourceIndex, 1);
        newExpenses.splice(destinationIndex, 0, reorderedExp);
      }

      onReorderExpenses(newExpenses);
    } else if (activeTab === 'packing') {
      const newItems = Array.from(packingItems);
      const [reorderedItem] = newItems.splice(sourceIndex, 1);
      newItems.splice(destinationIndex, 0, reorderedItem);
      onReorderPackingItems(newItems);
    }
  };

  const startEditingExpense = (expense: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingExpenseId(expense.id);
    setEditExpenseItemName(expense.item_name);
    setEditExpenseAmount(expense.amount.toString());
    setEditExpensePayer(expense.payer);
  };

  const saveEditingExpense = (expense: any, e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateExpense(expense.id, {
      item_name: editExpenseItemName,
      amount: parseFloat(editExpenseAmount),
      payer: editExpensePayer,
    });
    setEditingExpenseId(null);
  };

  const handlePackingAdd = () => {
    if (!packingItemName.trim() || !packingItemQuantity.trim()) return;
    
    onAddPackingItem({
      trip_id: selectedTrip.id,
      name: packingItemName,
      quantity: parseInt(packingItemQuantity, 10) || 1,
      category: packingItemCategory,
      is_checked: false,
      order_index: packingItems.length,
    });
    
    setPackingItemName('');
    setPackingItemQuantity('1');
    setPackingItemCategory('');
  };

  const startEditingPacking = (item: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPackingId(item.id);
    setEditPackingItemName(item.name);
    setEditPackingItemQuantity(item.quantity.toString());
  };

  const saveEditingPacking = (item: any, e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdatePackingItem(item.id, {
      name: editPackingItemName,
      quantity: parseInt(editPackingItemQuantity, 10) || 1,
    });
    setEditingPackingId(null);
  };

  const togglePackingItem = (item: any) => {
    onUpdatePackingItem(item.id, {
      is_checked: !item.is_checked
    });
    // Ensure the category stays expanded when an item inside is toggled.
    const cat = item.category || '未分類';
    setExpandedCategories(prev => {
      if (!prev.includes(cat)) {
        return [...prev, cat];
      }
      return prev;
    });
  };

  const startEditing = (item: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingItemId(item.id);
    setEditPlaceName(item.place_name || '');
    setEditStayDuration(item.stay_duration || '');
    setEditTravelTime(item.travel_time || '');
  };

  const saveEditing = (item: any, e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateItem(item.id, {
      place_name: editPlaceName,
      stay_duration: editStayDuration,
      travel_time: editTravelTime,
      day_id: item.day_id,
    });
    setEditingItemId(null);
  };

  const openNotesModal = (item: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setNoteEditingItem(item);
    setNoteText(item.notes || '');
    setNoteImages(item.note_images || []);
    setIsNotesModalOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!selectedTrip?.id) {
      alert('請先選擇一個行程');
      return;
    }

    // Limit original file size to 10MB for processing
    if (file.size > 10 * 1024 * 1024) {
      alert('圖片原始檔案太大，請選擇較小的圖片');
      return;
    }

    setIsUploading(true);
    console.log('Processing image as Base64 to bypass CORS...');
    
    try {
      const reader = new FileReader();
      
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            // Use canvas to resize and compress the image
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            // Max dimension 1000px
            const MAX_SIZE = 1000;
            if (width > height) {
              if (width > MAX_SIZE) {
                height *= MAX_SIZE / width;
                width = MAX_SIZE;
              }
            } else {
              if (height > MAX_SIZE) {
                width *= MAX_SIZE / height;
                height = MAX_SIZE;
              }
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            
            // Compress to JPEG with 0.7 quality
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            resolve(dataUrl);
          };
          img.onerror = reject;
          img.src = event.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const base64String = await base64Promise;
      
      // Check if the compressed string is too large for Firestore (approx 1MB limit per doc)
      // We'll keep it under 600KB to be safe since there might be multiple images
      if (base64String.length > 800000) {
        alert('圖片壓縮後仍然太大，請嘗試更小的圖片');
        setIsUploading(false);
        return;
      }

      setNoteImages(prev => [...prev, base64String]);
      console.log('Image processed and added as Base64');
    } catch (error: any) {
      console.error('Error processing image:', error);
      alert(`圖片處理失敗: ${error.message || '未知錯誤'}`);
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const removeNoteImage = (index: number) => {
    setNoteImages(prev => prev.filter((_, i) => i !== index));
  };

  const saveNotes = () => {
    if (noteEditingItem) {
      onUpdateItem(noteEditingItem.id, {
        notes: noteText,
        note_images: noteImages
      });
      setIsNotesModalOpen(false);
      setNoteEditingItem(null);
    }
  };

  return (
    <div className="w-full sm:w-96 bg-white dark:bg-black border-r border-slate-200 dark:border-slate-800 flex flex-col h-full z-10 shadow-lg transition-colors">
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
              {activeTab === 'itinerary' ? '新增行程' : activeTab === 'expenses' ? '新增記帳' : '新增攜帶清單'}
            </h2>
            <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-lg">
              <button
                onClick={() => setActiveTab('itinerary')}
                className={`p-1.5 rounded-md transition-all ${activeTab === 'itinerary' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-500'}`}
                title="行程規劃"
              >
                <MapPin className="w-4 h-4" />
              </button>
              <button
                onClick={() => setActiveTab('expenses')}
                className={`p-1.5 rounded-md transition-all ${activeTab === 'expenses' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-500'}`}
                title="記帳管理"
              >
                <Wallet className="w-4 h-4" />
              </button>
              <button
                onClick={() => setActiveTab('packing')}
                className={`p-1.5 rounded-md transition-all ${activeTab === 'packing' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-500'}`}
                title="攜帶清單"
              >
                <FileText className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {/* Days Navigation */}
          {activeTab !== 'packing' && (
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
                            <div className="flex items-center gap-1">
                              <span>Day</span>
                              <span className="notranslate" translate="no">{index + 1}</span>
                            </div>
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
          )}
          
          {activeTab === 'itinerary' ? (
          <div className="space-y-3">
            <div className="relative">
              <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="輸入地點名稱 (例: 東京車站)"
                className="w-full pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  if (timeWarning) setTimeWarning(null);
                }}
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
                  onChange={(e) => {
                    setStayDuration(e.target.value);
                    if (timeWarning) setTimeWarning(null);
                  }}
                />
              </div>
              <div className="relative flex-1">
                <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 z-10" />
                <TimeSelector 
                  value={travelTime} 
                  onChange={(val) => {
                    setTravelTime(val);
                    if (timeWarning) setTimeWarning(null);
                  }} 
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
            {timeWarning && (
              <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-[11px] text-amber-700 dark:text-amber-400 flex items-start gap-1.5 animate-in fade-in slide-in-from-top-1">
                <Zap className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-bold">時間提醒</p>
                  <p>{timeWarning}</p>
                  <button 
                    onClick={() => {
                      onAddItem({
                        trip_id: selectedTrip.id,
                        place_name: inputValue.trim(),
                        lat: 0,
                        lng: 0,
                        order_index: items.length,
                        stay_duration: stayDuration,
                        travel_time: travelTime,
                        day_id: selectedDayId,
                        notes: '',
                      });
                      setInputValue('');
                      setStayDuration('');
                      setTravelTime('');
                      setTimeWarning(null);
                    }}
                    className="mt-1 text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                  >
                    忽略並強制加入
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'expenses' ? (
          <div className="space-y-3">
            <div className="relative">
              <Banknote className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="消費項目 (例: 午餐、車票)"
                className="w-full pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                value={expenseItemName}
                onChange={(e) => setExpenseItemName(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-2 text-slate-400 text-sm">$</span>
                <input
                  type="number"
                  placeholder="金額"
                  className="w-full pl-7 pr-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                />
              </div>
              <div className="relative flex-1">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="付錢人"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  value={expensePayer}
                  onChange={(e) => setExpensePayer(e.target.value)}
                />
              </div>
            </div>
            <button
              onClick={handleExpenseAdd}
              disabled={!expenseItemName.trim() || !expenseAmount || !expensePayer.trim()}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" /> 加入記帳
            </button>
          </div>
        ) : activeTab === 'packing' ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-[2]">
                <FileText className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="攜帶項目 (例: 護照、充電線)"
                  className="w-full pl-9 pr-3 py-2 h-10 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  value={packingItemName}
                  onChange={(e) => setPackingItemName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handlePackingAdd();
                    }
                  }}
                />
              </div>
              <div className="relative flex-1">
                <input
                  type="number"
                  min="1"
                  placeholder="數量"
                  className="w-full px-3 py-2 h-10 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  value={packingItemQuantity}
                  onChange={(e) => setPackingItemQuantity(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handlePackingAdd();
                    }
                  }}
                />
              </div>
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="類別"
                  className="w-full px-3 py-2 h-10 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  value={packingItemCategory}
                  onChange={(e) => setPackingItemCategory(e.target.value)}
                  list="category-suggestions"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handlePackingAdd();
                    }
                  }}
                />
                <datalist id="category-suggestions">
                  {Array.from(new Set([...packingItems.map(item => item.category || '未分類'), '數位電器'])).map(cat => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>
            </div>
            <button
              onClick={handlePackingAdd}
              disabled={!packingItemName.trim() || !packingItemQuantity.trim()}
              className="w-full flex items-center justify-center gap-2 h-10 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" /> 加入清單
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50 dark:bg-black">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {activeTab === 'packing' ? '攜帶清單' : selectedDayId ? `Day ${tripDays.findIndex(d => d.id === selectedDayId) + 1} ${activeTab === 'itinerary' ? '行程列表' : '記帳列表'}` : `所有${activeTab === 'itinerary' ? '行程' : '記帳'}列表`}
            </h3>
            <div className="flex items-center gap-2">
              {activeTab === 'itinerary' && onExportICS && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleAutoSchedule}
                    disabled={filteredItems.length < 2}
                    className="p-1 text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors bg-white dark:bg-slate-800 rounded-md shadow-sm border border-slate-200 dark:border-slate-700 disabled:opacity-30"
                    title="自動串連時間 (依序排列並根據停留時間自動銜接)"
                  >
                    <Zap className="w-4 h-4" />
                  </button>
                  <button
                    onClick={onExportICS}
                    className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors bg-white dark:bg-slate-800 rounded-md shadow-sm border border-slate-200 dark:border-slate-700"
                    title="匯出至行事曆 (ICS)"
                  >
                    <Calendar className="w-4 h-4" />
                  </button>
                </div>
              )}
              {activeTab === 'itinerary' && filteredItems.length > 1 && (
                <button
                  onClick={() => {
                    onSelectItem(null);
                    if (window.innerWidth < 640) {
                      window.dispatchEvent(new CustomEvent('switch-to-map'));
                    }
                  }}
                  className={`text-xs flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${
                    selectedItemId === null
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-slate-200 dark:border-slate-700'
                  }`}
                  title="在地圖上顯示完整路線"
                >
                  <MapPin className="w-3 h-3" />
                  顯示路線
                </button>
              )}
            </div>
            {activeTab === 'expenses' && filteredExpenses.length > 0 && (
              <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-md flex items-center gap-1">
                <span>總計: $</span>
                <span className="notranslate" translate="no">
                  {filteredExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0).toLocaleString()}
                </span>
              </div>
            )}
          </div>
          
          {activeTab === 'itinerary' ? (
            filteredItems.length === 0 ? (
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
                                : hasConflict(index)
                                  ? 'border-red-500 ring-2 ring-red-100 dark:ring-red-900/30 bg-red-50/10'
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
                                  <span className="flex items-center gap-1">
                                    <span>Day</span>
                                    <span className="notranslate" translate="no">{tripDays.findIndex(d => d.id === item.day_id) + 1}</span>
                                  </span>
                                  </span>
                                )}
                              </h4>
                              {hasConflict(index) && (
                                <div className="mt-0.5 flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400 font-bold">
                                  <AlertTriangle className="w-3 h-3" /> 時間衝突：早於上一個行程結束
                                </div>
                              )}
                              
                              {editingItemId === item.id ? (
                                <div className="mt-2 space-y-2" onClick={e => e.stopPropagation()}>
                                  <div className="flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-slate-400" />
                                    <input
                                      type="text"
                                      placeholder="地點名稱"
                                      className="flex-1 px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                      value={editPlaceName}
                                      onChange={(e) => setEditPlaceName(e.target.value)}
                                    />
                                  </div>
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
                                      className="flex-1 px-2 py-1 text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded hover:bg-slate-200 dark:hover:bg-slate-600"
                                    >
                                      取消
                                    </button>
                                    <button
                                      onClick={(e) => saveEditing(item, e)}
                                      className="flex-1 px-2 py-1 text-xs text-white bg-indigo-600 rounded hover:bg-indigo-700 flex items-center justify-center gap-1"
                                    >
                                      <Check className="w-3 h-3" /> 儲存
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                                  {item.travel_time && (
                                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded ${
                                      hasConflict(index) 
                                        ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 font-bold' 
                                        : 'bg-slate-100 dark:bg-slate-700'
                                    }`}>
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
                                  {item.notes && (
                                    <span className="flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded italic">
                                      <FileText className="w-3 h-3" /> 有筆記
                                    </span>
                                  )}
                                  {item.note_images && item.note_images.length > 0 && (
                                    <span className="flex items-center gap-1 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded italic">
                                      <ImageIcon className="w-3 h-3" /> 有圖片
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            
                            {editingItemId !== item.id && (
                              <div className="flex flex-col gap-1">
                                <button
                                  onClick={(e) => openNotesModal(item, e)}
                                  className={`p-1 rounded-md transition-colors ${
                                    item.notes 
                                      ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30' 
                                      : 'text-slate-400 dark:text-slate-500 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'
                                  }`}
                                  title="詳細筆記"
                                >
                                  <FileText className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => startEditing(item, e)}
                                  className="text-slate-400 dark:text-slate-500 hover:text-indigo-500 p-1 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                                  title="編輯行程"
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
            )
          ) : activeTab === 'expenses' ? (
            filteredExpenses.length === 0 ? (
              <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                尚未加入任何記帳
              </div>
            ) : (
              <Droppable droppableId="expense-list">
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="space-y-3"
                  >
                    {filteredExpenses.map((expense, index) => (
                      // @ts-ignore
                      <Draggable key={String(expense.id)} draggableId={String(expense.id)} index={index}>
                        {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`bg-white dark:bg-slate-800 border rounded-lg shadow-sm p-3 flex items-start gap-3 transition-colors ${
                              snapshot.isDragging 
                                ? 'border-emerald-500 shadow-md ring-1 ring-emerald-500' 
                                : 'border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700'
                            }`}
                          >
                            <div
                              {...provided.dragHandleProps}
                              className="mt-1 text-slate-400 dark:text-slate-500 hover:text-emerald-500 cursor-grab active:cursor-grabbing"
                            >
                              <GripVertical className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              {editingExpenseId === expense.id ? (
                                <div className="space-y-2">
                                  <input
                                    type="text"
                                    className="w-full px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                    value={editExpenseItemName}
                                    onChange={(e) => setEditExpenseItemName(e.target.value)}
                                  />
                                  <div className="flex flex-col gap-2">
                                    <input
                                      type="number"
                                      className="w-full px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                      value={editExpenseAmount}
                                      onChange={(e) => setEditExpenseAmount(e.target.value)}
                                    />
                                    <input
                                      type="text"
                                      className="w-full px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                      value={editExpensePayer}
                                      onChange={(e) => setEditExpensePayer(e.target.value)}
                                    />
                                  </div>
                                  <div className="flex justify-end gap-2">
                                    <button
                                      onClick={() => setEditingExpenseId(null)}
                                      className="flex-1 px-2 py-1 text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded hover:bg-slate-200 dark:hover:bg-slate-600"
                                    >
                                      取消
                                    </button>
                                    <button
                                      onClick={(e) => saveEditingExpense(expense, e)}
                                      className="flex-1 px-2 py-1 text-xs text-white bg-emerald-600 rounded hover:bg-emerald-700 flex items-center justify-center gap-1"
                                    >
                                      <Check className="w-3 h-3" /> 儲存
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <h4 className="font-medium text-slate-900 dark:text-slate-100 truncate">
                                    {expense.item_name}
                                    {!selectedDayId && expense.day_id && tripDays.findIndex(d => d.id === expense.day_id) !== -1 && (
                                      <span className="ml-2 text-xs text-emerald-500 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded">
                                      <span className="flex items-center gap-1">
                                    <span>Day</span>
                                    <span className="notranslate" translate="no">{tripDays.findIndex(d => d.id === expense.day_id) + 1}</span>
                                  </span>
                                      </span>
                                    )}
                                  </h4>
                                  <div className="mt-1 flex flex-wrap gap-2 text-xs">
                                    <span className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded font-bold">
                                      $ {expense.amount}
                                    </span>
                                    <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded">
                                      <User className="w-3 h-3" /> {expense.payer}
                                    </span>
                                  </div>
                                </>
                              )}
                            </div>
                            
                            {editingExpenseId !== expense.id && (
                              <div className="flex flex-col gap-1">
                                <button
                                  onClick={(e) => startEditingExpense(expense, e)}
                                  className="text-slate-400 dark:text-slate-500 hover:text-emerald-500 p-1 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
                                  title="編輯"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteExpense(expense.id);
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
            )
          ) : activeTab === 'packing' ? (
              packingItems.length === 0 ? (
                <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                  尚未加入任何攜帶項目
                </div>
              ) : (
                <Droppable droppableId="packing-list">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-3 pb-20"
                    >
                      {(() => {
                        const grouped = packingItems.reduce((acc, item) => {
                          const cat = item.category || '未分類';
                          if (!acc[cat]) acc[cat] = [];
                          acc[cat].push(item);
                          return acc;
                        }, {} as Record<string, any[]>);

                        return Object.entries(grouped).map(([category, items]: [string, any[]]) => {
                          const isCollapsed = !expandedCategories.includes(category);
                          return (
                            <div key={category} className="mb-4">
                              <button
                                onClick={() => setExpandedCategories(prev => {
                                  return prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category];
                                })}
                                className="w-full flex items-center justify-between text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 p-2 bg-slate-100 dark:bg-slate-800 rounded"
                              >
                                <div className="flex items-center gap-2">
                                  <span>{category}</span>
                                  <span className="text-xs bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full notranslate" translate="no">
                                    {items.filter((i: any) => i.is_checked).length} / {items.length}
                                  </span>
                                </div>
                                <ChevronDown className={`w-4 h-4 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                              </button>
                              {!isCollapsed && items.map((item) => (
                              // @ts-ignore
                              <Draggable key={item.id} draggableId={item.id} index={packingItems.findIndex(i => i.id === item.id)}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    className={`bg-white dark:bg-slate-800 border rounded-lg shadow-sm p-3 flex items-center gap-3 transition-colors mb-2 ${
                                      snapshot.isDragging 
                                        ? 'border-indigo-500 shadow-md ring-1 ring-indigo-500' 
                                        : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                                    }`}
                                  >
                                    <div
                                      {...provided.dragHandleProps}
                                      className="text-slate-400 dark:text-slate-500 hover:text-indigo-500 cursor-grab active:cursor-grabbing"
                                    >
                                      <GripVertical className="w-5 h-5" />
                                    </div>
                                    
                                    <div className="flex-1 min-w-0 flex items-center gap-3">
                                      <input
                                        type="checkbox"
                                        checked={!!item.is_checked}
                                        onChange={() => togglePackingItem(item)}
                                        className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                      />
                                      
                                      {editingPackingId === item.id ? (
                                        <div className="flex-1 flex flex-col gap-2">
                                          <input
                                            type="text"
                                            className="w-full px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                            value={editPackingItemName}
                                            onChange={(e) => setEditPackingItemName(e.target.value)}
                                          />
                                          <div className="flex gap-2">
                                            <input
                                              type="number"
                                              min="1"
                                              className="flex-1 px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                              value={editPackingItemQuantity}
                                              onChange={(e) => setEditPackingItemQuantity(e.target.value)}
                                            />
                                            <div className="flex justify-end gap-1 flex-1">
                                              <button
                                                onClick={() => setEditingPackingId(null)}
                                                className="flex-1 px-2 py-1 text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-center"
                                              >
                                                取消
                                              </button>
                                              <button
                                                onClick={(e) => saveEditingPacking(item, e)}
                                                className="flex-1 px-2 py-1 text-xs text-white bg-indigo-600 rounded hover:bg-indigo-700 flex items-center justify-center gap-1"
                                              >
                                                <Check className="w-3 h-3" />
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="flex-1 flex items-center justify-between min-w-0">
                                          <span className={`font-medium truncate ${item.is_checked ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-slate-100'}`}>
                                            {item.name}
                                          </span>
                                          <span className="ml-2 text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-full">
                                            x{item.quantity}
                                          </span>
                                        </div>
                                      )}
                                      
                                      {editingPackingId !== item.id && (
                                        <div className="flex gap-1 shrink-0">
                                          <button
                                            onClick={(e) => startEditingPacking(item, e)}
                                            className="text-slate-400 dark:text-slate-500 hover:text-indigo-500 p-1 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                                            title="編輯"
                                          >
                                            <Edit2 className="w-4 h-4" />
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onDeletePackingItem(item.id);
                                            }}
                                            className="text-slate-400 dark:text-slate-500 hover:text-red-500 p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                            title="刪除"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                          </div>
                          );
                        });
                      })()}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              )
            ) : null
          }
        </div>
      </DragDropContext>

      {/* Notes Modal */}
      {isNotesModalOpen && noteEditingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 truncate max-w-[200px] sm:max-w-xs">
                  {noteEditingItem.place_name} - 詳細筆記
                </h3>
              </div>
              <button
                onClick={() => setIsNotesModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto space-y-4">
              <textarea
                className="w-full h-48 p-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
                placeholder="在此輸入詳細筆記、預約資訊、交通方式等..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                autoFocus
              />
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" /> 圖片備註
                  </h4>
                  <label className={`cursor-pointer flex items-center gap-1 text-xs font-medium px-2 py-1 rounded transition-colors ${isUploading ? 'bg-slate-100 text-slate-400' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400'}`}>
                    {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    上傳圖片
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isUploading} />
                  </label>
                </div>
                
                {noteImages.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {noteImages.map((url, index) => (
                      <div key={index} className="relative group aspect-video rounded-md overflow-hidden border border-slate-200 dark:border-slate-700 cursor-pointer">
                        <img 
                          src={url} 
                          alt={`Note ${index}`} 
                          className="w-full h-full object-cover hover:scale-110 transition-transform duration-300" 
                          referrerPolicy="no-referrer" 
                          onClick={() => setPreviewImageUrl(url)}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeNoteImage(index);
                          }}
                          className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-md text-slate-400 text-xs">
                    尚未上傳任何圖片
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => setIsNotesModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                取消
              </button>
              <button
                onClick={saveNotes}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 flex items-center gap-2"
              >
                <Check className="w-4 h-4" /> 儲存筆記
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImageUrl && (
        <div 
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-[200] p-4 cursor-zoom-out"
          onClick={() => setPreviewImageUrl(null)}
        >
          <button 
            className="absolute top-4 right-4 text-white/70 hover:text-white p-2 bg-white/10 rounded-full transition-colors"
            onClick={() => setPreviewImageUrl(null)}
          >
            <X className="w-6 h-6" />
          </button>
          <img 
            src={previewImageUrl} 
            alt="Preview" 
            className="max-w-full max-h-full object-contain shadow-2xl animate-in zoom-in-95 duration-200"
            referrerPolicy="no-referrer"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
