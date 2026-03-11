import React, { useState, useEffect } from 'react';
import { LogOut, Plus, Minus, Map as MapIcon, Trash2, X, Sun, Moon, Users, UserPlus, UserMinus, Sparkles, Loader2 } from 'lucide-react';
import Sidebar from './Sidebar';
import MapView from './Map';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc, getDocs, writeBatch, orderBy, getDoc, setDoc, or, arrayUnion, arrayRemove } from 'firebase/firestore';
import { GoogleGenAI, Type } from "@google/genai";

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

interface PlannerProps {
  token: string;
  user: any;
  onLogout: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export default function Planner({ token, user, onLogout, theme, onToggleTheme }: PlannerProps) {
  const [trips, setTrips] = useState<any[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<any>(null);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [travelMode, setTravelMode] = useState<string>('DRIVING');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'itinerary' | 'map'>('itinerary');
  
  // Collaborators state
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [isCollabModalOpen, setIsCollabModalOpen] = useState(false);
  const [collabEmail, setCollabEmail] = useState('');
  const [collabError, setCollabError] = useState('');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTripTitle, setNewTripTitle] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [tripToDeleteId, setTripToDeleteId] = useState('');

  useEffect(() => {
    if (!user) return;

    const ensurePublicProfile = async () => {
      if (!user.email) return;
      const publicUserRef = doc(db, 'users_public', user.uid);
      const publicUserSnap = await getDoc(publicUserRef);
      if (!publicUserSnap.exists()) {
        await setDoc(publicUserRef, {
          email: user.email.toLowerCase()
        });
      }
    };
    ensurePublicProfile();

    const q = query(
      collection(db, 'trips'), 
      or(
        where('user_id', '==', user.uid),
        where('collaborator_ids', 'array-contains', user.uid)
      )
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Manually de-duplicate by document ID to prevent "duplicate key" warnings
      const uniqueDocs = new Map();
      snapshot.docs.forEach(doc => {
        uniqueDocs.set(doc.id, { id: doc.id, ...doc.data() as any });
      });
      const tripsData = Array.from(uniqueDocs.values());
      
      console.log('Current User UID:', user.uid);
      console.log('Fetched Trips:', tripsData);
      setTrips(tripsData);
      
      if (selectedTrip) {
        const updated = tripsData.find(t => t.id === selectedTrip.id);
        if (updated) setSelectedTrip(updated);
      } else if (tripsData.length > 0) {
        setSelectedTrip(tripsData[0]);
      }
      setLoading(false);
    }, (err) => {
      console.error('Trips snapshot error:', err);
      handleFirestoreError(err, OperationType.LIST, 'trips');
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (selectedTrip) {
      const itemsQ = query(collection(db, 'trips', selectedTrip.id, 'items'), orderBy('order_index'));
      const unsubscribeItems = onSnapshot(itemsQ, (snapshot) => {
        const uniqueItems = new Map();
        snapshot.docs.forEach(doc => {
          uniqueItems.set(doc.id, { id: doc.id, ...doc.data() });
        });
        const itemsData = Array.from(uniqueItems.values());
        setItems(itemsData);
      });

      const collabQ = query(collection(db, 'trips', selectedTrip.id, 'collaborators'));
      const unsubscribeCollab = onSnapshot(collabQ, (snapshot) => {
        const uniqueCollabs = new Map();
        snapshot.docs.forEach(doc => {
          uniqueCollabs.set(doc.id, { id: doc.id, ...doc.data() });
        });
        const collabData = Array.from(uniqueCollabs.values());
        setCollaborators(collabData);
      });

      setSelectedItemId(null);

      // Ensure at least one day exists
      let days = [];
      try {
        days = selectedTrip.days ? JSON.parse(selectedTrip.days) : [];
      } catch (e) {
        days = [];
      }
      
      const checkAndInitializeDays = async () => {
        if (days.length === 0 && selectedTrip.id) {
          const tripRef = doc(db, 'trips', selectedTrip.id);
          const tripSnap = await getDoc(tripRef);
          if (tripSnap.exists() && (!tripSnap.data().days || JSON.parse(tripSnap.data().days).length === 0)) {
            handleUpdateTripDays([{ id: Date.now().toString(), title: 'Day 1' }]);
          }
        } else if (!selectedDayId && days.length > 0) {
          setSelectedDayId(days[0].id);
        }
      };
      
      checkAndInitializeDays();

      return () => {
        unsubscribeItems();
        unsubscribeCollab();
      };
    } else {
      setItems([]);
      setCollaborators([]);
      setSelectedItemId(null);
      setSelectedDayId(null);
    }
  }, [selectedTrip]);

  const handleAddCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collabEmail.trim() || !selectedTrip) return;
    setCollabError('');

    try {
      // Check if user exists
      const usersRef = collection(db, 'users_public');
      
      // Debug: Log all users
      const allUsersSnapshot = await getDocs(usersRef);
      console.log('All users in users_public:', allUsersSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));

      const targetEmail = collabEmail.trim().toLowerCase();
      const q = query(usersRef, where('email', '==', targetEmail));
      console.log('Searching for:', targetEmail);
      const userSnapshot = await getDocs(q).catch(err => { console.error('Search error:', err); handleFirestoreError(err, OperationType.LIST, 'users'); throw err; });
      console.log('Search result empty:', userSnapshot.empty);
      
      if (userSnapshot.empty) {
        setCollabError('找不到該使用者');
        return;
      }
      
      const userId = userSnapshot.docs[0].id;
      if (userId === user.uid) {
        setCollabError('您不能將自己加入協作者');
        return;
      }

      // Check if already a collaborator
      if (selectedTrip.collaborator_ids?.includes(userId)) {
        setCollabError('此使用者已經是協作者');
        return;
      }

      await setDoc(doc(db, 'trips', selectedTrip.id, 'collaborators', userId), {
        id: userId,
        email: collabEmail.trim()
      }).catch(err => { handleFirestoreError(err, OperationType.CREATE, `trips/${selectedTrip.id}/collaborators`); throw err; });
      
      await updateDoc(doc(db, 'trips', selectedTrip.id), {
        collaborator_ids: arrayUnion(userId)
      }).catch(err => { console.error('Update collaborator_ids error:', err); throw err; });
      
      console.log('Successfully added collaborator:', userId);
      setCollabEmail('');
    } catch (err) {
      console.error('Add collaborator error:', err);
      setCollabError('發生錯誤，請稍後再試');
    }
  };

  const handleRemoveCollaborator = async (userId: string) => {
    if (!selectedTrip) return;
    try {
      const collabRef = doc(db, 'trips', selectedTrip.id, 'collaborators', userId);
      await deleteDoc(collabRef).catch(err => { handleFirestoreError(err, OperationType.DELETE, `trips/${selectedTrip.id}/collaborators/${userId}`); throw err; });
      
      await updateDoc(doc(db, 'trips', selectedTrip.id), {
        collaborator_ids: arrayRemove(userId)
      });
    } catch (err) {
      console.error('Failed to remove collaborator', err);
    }
  };

  // Removed fetchTrips and fetchItems as they are now handled by onSnapshot

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTripTitle.trim()) return;

    try {
      const newTrip = await addDoc(collection(db, 'trips'), {
        title: newTripTitle.trim(),
        user_id: user.uid,
        collaborator_ids: [],
        days: JSON.stringify([{ id: Date.now().toString(), title: 'Day 1' }])
      }).catch(err => { handleFirestoreError(err, OperationType.CREATE, 'trips'); throw err; });
      setSelectedTrip({ 
        id: newTrip.id, 
        title: newTripTitle.trim(), 
        user_id: user.uid, 
        collaborator_ids: [],
        days: JSON.stringify([{ id: Date.now().toString(), title: 'Day 1' }]) 
      });
      setIsModalOpen(false);
      setNewTripTitle('');
    } catch (err) {
      console.error('Failed to create trip', err);
    }
  };

  const handleAICreateTrip = async () => {
    if (!newTripTitle.trim()) return;
    setIsGeneratingAI(true);

    try {
      // 1. Parse number of days from title (Support digits and complex Chinese numbers)
      const title = newTripTitle.trim();
      
      const parseChineseNumber = (str: string): number => {
        const map: { [key: string]: number } = {
          '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10
        };
        if (/^\d+$/.test(str)) return parseInt(str, 10);
        
        if (str === '十') return 10;
        if (str.length === 2 && str[0] === '十') return 10 + (map[str[1]] || 0);
        if (str.length === 2 && str[1] === '十') return (map[str[0]] || 0) * 10;
        if (str.length === 3 && str[1] === '十') return (map[str[0]] || 0) * 10 + (map[str[2]] || 0);
        
        return map[str] || 1;
      };
      
      const dayMatch = title.match(/(\d+|[一二三四五六七八九十]+)\s*(日|day)/i);
      const numDays = dayMatch ? parseChineseNumber(dayMatch[1]) : 1;
      const limitedDays = Math.min(Math.max(numDays, 1), 14); // Increased limit to 14 days

      // 2. Prepare days structure
      const days = [];
      const now = Date.now();
      for (let i = 1; i <= limitedDays; i++) {
        days.push({ id: `${now}-${i}`, title: `Day ${i}` });
      }

      // 3. Call Gemini to generate itinerary items for multiple days
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: `為名為「${title}」的行程規劃一份詳細的景點清單。這是一個 ${limitedDays} 天的行程。請為每一天提供約 2-4 個推薦景點。對於每個景點，請提供名稱、建議停留時間（分鐘）、建議開始時間（24小時制 HH:MM 格式，從早上 09:00 開始安排）以及它屬於第幾天（day_index，從 1 開始）。`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                place_name: { type: Type.STRING, description: "景點名稱" },
                stay_duration: { type: Type.STRING, description: "停留時間（分鐘），僅數字字串" },
                travel_time: { type: Type.STRING, description: "開始時間，格式為 HH:MM" },
                day_index: { type: Type.INTEGER, description: "第幾天，從 1 開始" }
              },
              required: ["place_name", "stay_duration", "travel_time", "day_index"]
            }
          }
        }
      });

      const aiItems = JSON.parse(response.text || "[]");
      
      // 4. Create the trip first
      const newTripRef = await addDoc(collection(db, 'trips'), {
        title: title,
        user_id: user.uid,
        collaborator_ids: [],
        days: JSON.stringify(days)
      }).catch(err => { handleFirestoreError(err, OperationType.CREATE, 'trips'); throw err; });

      // 5. Add generated items to Firestore, mapping day_index to day.id
      const batch = writeBatch(db);
      aiItems.forEach((item: any, index: number) => {
        const dayIdx = (item.day_index || 1) - 1;
        const targetDay = days[dayIdx] || days[0];
        
        const itemRef = doc(collection(db, 'trips', newTripRef.id, 'items'));
        batch.set(itemRef, {
          place_name: item.place_name,
          stay_duration: String(item.stay_duration),
          travel_time: item.travel_time,
          trip_id: newTripRef.id,
          day_id: targetDay.id,
          order_index: index,
          lat: 0,
          lng: 0
        });
      });
      await batch.commit().catch(err => { handleFirestoreError(err, OperationType.WRITE, `trips/${newTripRef.id}/items`); throw err; });

      // 6. Update local state to trigger UI update
      const newTripData = {
        id: newTripRef.id,
        title: title,
        user_id: user.uid,
        collaborator_ids: [],
        days: JSON.stringify(days)
      };
      
      setSelectedTrip(newTripData);
      setSelectedDayId(days[0].id);
      setIsModalOpen(false);
      setNewTripTitle('');
    } catch (err) {
      console.error('AI generation failed', err);
      alert('AI 規劃失敗，請稍後再試或手動建立行程。');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleDeleteTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tripToDeleteId) return;

    try {
      await deleteDoc(doc(db, 'trips', tripToDeleteId)).catch(err => { handleFirestoreError(err, OperationType.DELETE, `trips/${tripToDeleteId}`); throw err; });
      
      const updatedTrips = trips.filter(t => t.id !== tripToDeleteId);
      setTrips(updatedTrips);
      if (selectedTrip?.id === tripToDeleteId) {
        setSelectedTrip(updatedTrips.length > 0 ? updatedTrips[0] : null);
      }
      setIsDeleteModalOpen(false);
      setTripToDeleteId('');
    } catch (err) {
      console.error('Failed to delete trip', err);
    }
  };

  const handleAddItem = async (itemData: any) => {
    if (!selectedTrip) return;
    try {
      const newItem = await addDoc(collection(db, 'trips', selectedTrip.id, 'items'), itemData).catch(err => { handleFirestoreError(err, OperationType.CREATE, `trips/${selectedTrip.id}/items`); throw err; });
      setSelectedItemId(newItem.id);
    } catch (err) {
      console.error('Failed to add item', err);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!selectedTrip) return;
    try {
      await deleteDoc(doc(db, 'trips', selectedTrip.id, 'items', itemId)).catch(err => { handleFirestoreError(err, OperationType.DELETE, `trips/${selectedTrip.id}/items/${itemId}`); throw err; });
      if (selectedItemId === itemId) {
        setSelectedItemId(null);
      }
    } catch (err) {
      console.error('Failed to delete item', err);
    }
  };

  const handleUpdateTripDays = async (days: any[]) => {
    if (!selectedTrip) return;
    try {
      await updateDoc(doc(db, 'trips', selectedTrip.id), {
        days: JSON.stringify(days)
      }).catch(err => { handleFirestoreError(err, OperationType.UPDATE, `trips/${selectedTrip.id}`); throw err; });
      const updatedTrip = { ...selectedTrip, days: JSON.stringify(days) };
      setSelectedTrip(updatedTrip);
    } catch (err) {
      console.error('Failed to update trip days', err);
    }
  };

  const handleUpdateItem = async (itemId: string, updates: any) => {
    if (!selectedTrip) return;
    try {
      await updateDoc(doc(db, 'trips', selectedTrip.id, 'items', itemId), updates).catch(err => { handleFirestoreError(err, OperationType.UPDATE, `trips/${selectedTrip.id}/items/${itemId}`); throw err; });
    } catch (err) {
      console.error('Failed to update item', err);
    }
  };

  const handleReorderItems = async (reorderedItems: any[]) => {
    if (!selectedTrip) return;

    const batch = writeBatch(db);
    reorderedItems.forEach((item, index) => {
      const itemRef = doc(db, 'trips', selectedTrip.id, 'items', item.id);
      batch.update(itemRef, {
        order_index: index,
        day_id: item.day_id,
      });
    });

    try {
      await batch.commit().catch(err => { handleFirestoreError(err, OperationType.WRITE, `trips/${selectedTrip.id}/items`); throw err; });
    } catch (err) {
      console.error('Failed to reorder items', err);
    }
  };

  const getTripDays = () => {
    if (!selectedTrip || !selectedTrip.days) return [];
    try {
      return JSON.parse(selectedTrip.days);
    } catch (e) {
      return [];
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">載入中...</div>;
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-black text-slate-900 dark:text-white transition-colors relative">
      {/* Header */}
      <header className="bg-indigo-600 dark:bg-black text-white shadow-sm z-20 border-b dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-2 sm:gap-4">
          {/* Left: Brand */}
          <div className="flex items-center gap-2 shrink-0">
            <MapIcon className="w-6 h-6" />
            <h1 className="text-lg font-bold hidden sm:block">旅遊規劃器</h1>
          </div>
          
          {/* Center: Trip Management Group */}
          <div className="flex-1 flex justify-center max-w-xl">
            <div className="flex items-center bg-white/10 dark:bg-slate-800/50 rounded-full px-2 py-1 gap-1 w-full border border-white/10">
              <select
                className="flex-1 bg-transparent border-none text-white text-sm rounded-md focus:ring-0 cursor-pointer min-w-0"
                value={selectedTrip?.id || ''}
                onChange={(e) => {
                  const trip = trips.find((t) => t.id === e.target.value);
                  setSelectedTrip(trip || null);
                }}
              >
                <option value="" disabled className="text-slate-900">選擇行程</option>
                {trips.map((trip) => (
                  <option key={trip.id} value={trip.id} className="text-slate-900">
                    {trip.title}
                  </option>
                ))}
              </select>
              
              <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
                  title="新增行程"
                >
                  <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                <button
                  onClick={() => {
                    setTripToDeleteId(selectedTrip?.id || '');
                    setIsDeleteModalOpen(true);
                  }}
                  className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
                  title="刪除行程"
                >
                  <Minus className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                {selectedTrip && (
                  <button
                    onClick={() => setIsCollabModalOpen(true)}
                    className="p-1.5 hover:bg-white/20 rounded-full transition-colors relative"
                    title="協作者管理"
                  >
                    <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                    {collaborators.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-emerald-500 text-[9px] font-bold px-1 rounded-full min-w-[14px] h-3.5 flex items-center justify-center border border-indigo-600">
                        {collaborators.length}
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right: System Actions */}
          <div className="flex items-center gap-1 sm:gap-3 shrink-0">
            <button
              onClick={onToggleTheme}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
              title={theme === 'light' ? '切換深色模式' : '切換淺色模式'}
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            
            <button
              onClick={onLogout}
              className="flex items-center gap-1 px-2 py-1.5 hover:bg-white/10 rounded-lg transition-colors text-sm"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">登出</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden relative">
        {selectedTrip ? (
          <>
            <div className={`${mobileView === 'itinerary' ? 'block' : 'hidden'} sm:block w-full sm:w-96 h-full overflow-y-auto`}>
              <Sidebar
                selectedTrip={selectedTrip}
                items={items}
                onAddItem={handleAddItem}
                onDeleteItem={handleDeleteItem}
                onReorder={handleReorderItems}
                travelMode={travelMode}
                onTravelModeChange={setTravelMode}
                selectedItemId={selectedItemId}
                onSelectItem={setSelectedItemId}
                tripDays={getTripDays()}
                onUpdateTripDays={handleUpdateTripDays}
                onUpdateItem={handleUpdateItem}
                selectedDayId={selectedDayId}
                setSelectedDayId={setSelectedDayId}
              />
            </div>
            <div className={`${mobileView === 'map' ? 'block' : 'hidden'} sm:block flex-1 relative h-full`}>
              <MapView 
                items={selectedDayId ? items.filter(i => i.day_id === selectedDayId) : items} 
                travelMode={travelMode} 
                onTravelModeChange={setTravelMode}
                selectedItemId={selectedItemId} 
              />
            </div>
            
            {/* Mobile Toggle */}
            <div className="sm:hidden absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex bg-indigo-600 rounded-full shadow-lg p-1">
              <button 
                onClick={() => setMobileView('itinerary')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${mobileView === 'itinerary' ? 'bg-white text-indigo-600' : 'text-white'}`}
              >
                行程
              </button>
              <button 
                onClick={() => setMobileView('map')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${mobileView === 'map' ? 'bg-white text-indigo-600' : 'text-white'}`}
              >
                地圖
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
            <MapIcon className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg">您還沒有任何行程</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 shadow-sm"
            >
              建立第一個行程
            </button>
          </div>
        )}
      </main>

      {/* Create Trip Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">新增行程</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateTrip} className="p-4">
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  行程名稱
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="例如：日本五日遊"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={newTripTitle}
                  onChange={(e) => setNewTripTitle(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={isGeneratingAI || !newTripTitle.trim()}
                  className="w-full py-2.5 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  建立空白行程
                </button>
                <button
                  type="button"
                  onClick={handleAICreateTrip}
                  disabled={isGeneratingAI || !newTripTitle.trim()}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-md hover:from-indigo-600 hover:to-purple-700 font-medium transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50"
                >
                  {isGeneratingAI ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      AI 規劃中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      AI 快速規劃
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-full py-2 px-4 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Trip Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">刪除行程</h3>
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleDeleteTrip} className="p-4">
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  選擇要刪除的行程
                </label>
                <select
                  required
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={tripToDeleteId}
                  onChange={(e) => setTripToDeleteId(e.target.value)}
                >
                  <option value="" disabled>請選擇行程</option>
                  {trips.filter(t => t.user_id === user.uid).map((trip) => (
                    <option key={trip.id} value={trip.id}>
                      {trip.title}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-red-500">
                  警告：刪除行程將會移除所有相關的景點與協作者，此動作無法復原。
                  (僅能刪除您擁有的行程)
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700"
                >
                  確認刪除
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Collaborators Modal */}
      {isCollabModalOpen && selectedTrip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">協作者管理</h3>
              </div>
              <button
                onClick={() => setIsCollabModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                邀請其他使用者共同編輯此行程。
              </p>

              <form onSubmit={handleAddCollaborator} className="flex gap-2 mb-6">
                <div className="flex-1">
                  <input
                    type="email"
                    required
                    placeholder="輸入協作者信箱"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    value={collabEmail}
                    onChange={(e) => setCollabEmail(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium flex items-center gap-1"
                >
                  <UserPlus className="w-4 h-4" /> 邀請
                </button>
              </form>

              {collabError && (
                <p className="text-xs text-red-500 mb-4">{collabError}</p>
              )}

              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">目前的協作者</h4>
                
                {/* Owner */}
                <div className="flex items-center justify-between p-2 rounded-md bg-slate-50 dark:bg-slate-900/50">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-300 font-bold text-xs flex-shrink-0">
                      {selectedTrip.user_id === user.uid ? '我' : '主'}
                    </div>
                    <div className="truncate">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                        {selectedTrip.user_id === user.uid ? '您 (擁有者)' : '擁有者'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Collaborators List */}
                {collaborators.map((collab) => (
                  <div key={collab.id} className="flex items-center justify-between p-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold text-xs flex-shrink-0">
                        {collab.email[0].toUpperCase()}
                      </div>
                      <div className="truncate">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{collab.email}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">編輯者</p>
                      </div>
                    </div>
                    {selectedTrip.user_id === user.uid && (
                      <button
                        onClick={() => handleRemoveCollaborator(collab.id)}
                        className="p-1 text-slate-400 hover:text-red-500 transition-colors bg-slate-100 dark:bg-slate-800 rounded-full"
                        title="移除協作者"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}

                {collaborators.length === 0 && (
                  <p className="text-center py-4 text-sm text-slate-400 italic">尚未添加任何協作者</p>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700 flex justify-end">
              <button
                onClick={() => setIsCollabModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
