import React, { useState, useEffect } from 'react';
import { LogOut, Plus, Minus, Map as MapIcon, Trash2, X, Sun, Moon, Users, UserPlus, UserMinus, Edit2 } from 'lucide-react';
import Sidebar from './Sidebar';
import MapView from './Map';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc, getDocs, writeBatch, orderBy, getDoc, setDoc, or, arrayUnion, arrayRemove } from 'firebase/firestore';

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
  const [expenses, setExpenses] = useState<any[]>([]);
  const [packingItems, setPackingItems] = useState<any[]>([]);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'itinerary' | 'expenses' | 'packing'>('itinerary');
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
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [tripToDeleteId, setTripToDeleteId] = useState('');
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameTripTitle, setRenameTripTitle] = useState('');

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

      const expensesQ = query(collection(db, 'trips', selectedTrip.id, 'expenses'), orderBy('order_index'));
      const unsubscribeExpenses = onSnapshot(expensesQ, (snapshot) => {
        const uniqueExpenses = new Map();
        snapshot.docs.forEach(doc => {
          uniqueExpenses.set(doc.id, { id: doc.id, ...doc.data() });
        });
        const expensesData = Array.from(uniqueExpenses.values());
        setExpenses(expensesData);
      });

      const packingQ = query(collection(db, 'trips', selectedTrip.id, 'packingList'), orderBy('order_index'));
      const unsubscribePacking = onSnapshot(packingQ, (snapshot) => {
        const uniquePacking = new Map();
        snapshot.docs.forEach(doc => {
          uniquePacking.set(doc.id, { id: doc.id, ...doc.data() });
        });
        const packingData = Array.from(uniquePacking.values());
        setPackingItems(packingData);
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
      
      if (days.length === 0) {
        handleUpdateTripDays([{ id: Date.now().toString(), title: 'Day 1' }]);
      } else if (!selectedDayId) {
        setSelectedDayId(days[0].id);
      }

      return () => {
        unsubscribeItems();
        unsubscribeExpenses();
        unsubscribePacking();
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
      const newTripRef = await addDoc(collection(db, 'trips'), {
        title: newTripTitle.trim(),
        user_id: user.uid,
        collaborator_ids: [],
        days: JSON.stringify([{ id: Date.now().toString(), title: 'Day 1' }])
      }).catch(err => { handleFirestoreError(err, OperationType.CREATE, 'trips'); throw err; });

      // Add default packing items
      const batch = writeBatch(db);
      const defaultPackingItems = [
        { name: '內褲', quantity: 1, is_checked: false, category: '衣服與配飾' },
        { name: '襪子', quantity: 1, is_checked: false, category: '衣服與配飾' },
        { name: '上衣', quantity: 1, is_checked: false, category: '衣服與配飾' },
        { name: '內衣', quantity: 1, is_checked: false, category: '衣服與配飾' },
        { name: '裙子', quantity: 1, is_checked: false, category: '衣服與配飾' },
        { name: '睡衣', quantity: 1, is_checked: false, category: '衣服與配飾' },
        { name: '休閒鞋', quantity: 1, is_checked: false, category: '衣服與配飾' },
        { name: '褲子', quantity: 1, is_checked: false, category: '衣服與配飾' },
        { name: '帽子', quantity: 1, is_checked: false, category: '衣服與配飾' },
        { name: '飾品', quantity: 1, is_checked: false, category: '衣服與配飾' },
        { name: '身分證/護照', quantity: 1, is_checked: false, category: '出行必備' },
        { name: '國際駕照', quantity: 1, is_checked: false, category: '出行必備' },
        { name: '信用卡/現金', quantity: 1, is_checked: false, category: '出行必備' },
        { name: '旅平險', quantity: 1, is_checked: false, category: '出行必備' },
        { name: '毛巾', quantity: 1, is_checked: false, category: '生活日用' },
        { name: '牙膏/牙刷', quantity: 1, is_checked: false, category: '生活日用' },
        { name: '洗面乳', quantity: 1, is_checked: false, category: '生活日用' },
        { name: '紙巾/濕紙巾', quantity: 1, is_checked: false, category: '生活日用' },
        { name: '刮鬍刀', quantity: 1, is_checked: false, category: '生活日用' },
        { name: '衛生棉', quantity: 1, is_checked: false, category: '生活日用' },
        { name: '化妝品', quantity: 1, is_checked: false, category: '生活日用' },
        { name: '防曬乳', quantity: 1, is_checked: false, category: '生活日用' },
        { name: '水壺/保溫杯', quantity: 1, is_checked: false, category: '生活日用' },
        { name: '隱形/保養液', quantity: 1, is_checked: false, category: '生活日用' },
        { name: '眼鏡盒', quantity: 1, is_checked: false, category: '生活日用' },
        { name: '購物袋', quantity: 1, is_checked: false, category: '生活日用' },
        { name: '充電器/充電線', quantity: 1, is_checked: false, category: '數位電器' },
        { name: '耳機', quantity: 1, is_checked: false, category: '數位電器' },
        { name: '行動電源', quantity: 1, is_checked: false, category: '數位電器' },
        { name: '萬國插座', quantity: 1, is_checked: false, category: '數位電器' },
        { name: '相機', quantity: 1, is_checked: false, category: '數位電器' },
        { name: '平板/筆電', quantity: 1, is_checked: false, category: '數位電器' },
        { name: '延長線', quantity: 1, is_checked: false, category: '數位電器' },
        { name: 'esim/sim card', quantity: 1, is_checked: false, category: '數位電器' }
      ];

      defaultPackingItems.forEach((item, index) => {
        const itemRef = doc(collection(db, 'trips', newTripRef.id, 'packingList'));
        batch.set(itemRef, {
          ...item,
          trip_id: newTripRef.id,
          order_index: index
        });
      });

      await batch.commit().catch(err => { handleFirestoreError(err, OperationType.WRITE, `trips/${newTripRef.id}/packingList`); throw err; });

      setSelectedTrip({ 
        id: newTripRef.id, 
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

  const handleRenameTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrip || !renameTripTitle.trim()) return;

    try {
      await updateDoc(doc(db, 'trips', selectedTrip.id), {
        title: renameTripTitle.trim()
      }).catch(err => { handleFirestoreError(err, OperationType.UPDATE, `trips/${selectedTrip.id}`); throw err; });

      setSelectedTrip({ ...selectedTrip, title: renameTripTitle.trim() });
      setIsRenameModalOpen(false);
      setRenameTripTitle('');
    } catch (error) {
      console.error('Error renaming trip:', error);
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

  const handleAddExpense = async (expenseData: any) => {
    if (!selectedTrip) return;
    try {
      await addDoc(collection(db, 'trips', selectedTrip.id, 'expenses'), expenseData).catch(err => { handleFirestoreError(err, OperationType.CREATE, `trips/${selectedTrip.id}/expenses`); throw err; });
    } catch (err) {
      console.error('Failed to add expense', err);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!selectedTrip) return;
    try {
      await deleteDoc(doc(db, 'trips', selectedTrip.id, 'expenses', expenseId)).catch(err => { handleFirestoreError(err, OperationType.DELETE, `trips/${selectedTrip.id}/expenses/${expenseId}`); throw err; });
    } catch (err) {
      console.error('Failed to delete expense', err);
    }
  };

  const handleUpdateExpense = async (expenseId: string, updates: any) => {
    if (!selectedTrip) return;
    try {
      await updateDoc(doc(db, 'trips', selectedTrip.id, 'expenses', expenseId), updates).catch(err => { handleFirestoreError(err, OperationType.UPDATE, `trips/${selectedTrip.id}/expenses/${expenseId}`); throw err; });
    } catch (err) {
      console.error('Failed to update expense', err);
    }
  };

  const handleReorderExpenses = async (reorderedExpenses: any[]) => {
    if (!selectedTrip) return;

    const batch = writeBatch(db);
    reorderedExpenses.forEach((expense, index) => {
      const expenseRef = doc(db, 'trips', selectedTrip.id, 'expenses', expense.id);
      batch.update(expenseRef, {
        order_index: index,
        day_id: expense.day_id,
      });
    });

    try {
      await batch.commit().catch(err => { handleFirestoreError(err, OperationType.WRITE, `trips/${selectedTrip.id}/expenses`); throw err; });
    } catch (err) {
      console.error('Failed to reorder expenses', err);
    }
  };

  const handleAddPackingItem = async (packingData: any) => {
    if (!selectedTrip) return;
    try {
      if (packingData.category === '數位電器') {
        const digitalItems = [
          '充電器/充電線', '耳機', '行動電源', '萬國插座', '相機', '平板/筆電', '延長線', 'esim/sim card'
        ];
        const batch = writeBatch(db);
        digitalItems.forEach((name, index) => {
          const itemRef = doc(collection(db, 'trips', selectedTrip.id, 'packingList'));
          batch.set(itemRef, {
            name,
            quantity: 1,
            category: '數位電器',
            is_checked: false,
            order_index: packingItems.length + index
          });
        });
        await batch.commit();
      } else {
        await addDoc(collection(db, 'trips', selectedTrip.id, 'packingList'), packingData).catch(err => { handleFirestoreError(err, OperationType.CREATE, `trips/${selectedTrip.id}/packingList`); throw err; });
      }
    } catch (err) {
      console.error('Failed to add packing item', err);
    }
  };

  const handleDeletePackingItem = async (itemId: string) => {
    if (!selectedTrip) return;
    
    // Optimistic update
    setPackingItems(prev => prev.filter(item => item.id !== itemId));

    try {
      await deleteDoc(doc(db, 'trips', selectedTrip.id, 'packingList', itemId)).catch(err => { handleFirestoreError(err, OperationType.DELETE, `trips/${selectedTrip.id}/packingList/${itemId}`); throw err; });
    } catch (err) {
      console.error('Failed to delete packing item', err);
    }
  };

  const handleUpdatePackingItem = async (itemId: string, updates: any) => {
    if (!selectedTrip) return;
    
    // Optimistic update for immediate UI feedback
    setPackingItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, ...updates } : item
    ));

    try {
      await updateDoc(doc(db, 'trips', selectedTrip.id, 'packingList', itemId), updates).catch(err => { handleFirestoreError(err, OperationType.UPDATE, `trips/${selectedTrip.id}/packingList/${itemId}`); throw err; });
    } catch (err) {
      console.error('Failed to update packing item', err);
    }
  };

  const handleReorderPackingItems = async (reorderedItems: any[]) => {
    if (!selectedTrip) return;

    // Optimistic update
    setPackingItems(reorderedItems);

    const batch = writeBatch(db);
    reorderedItems.forEach((item, index) => {
      const itemRef = doc(db, 'trips', selectedTrip.id, 'packingList', item.id);
      batch.update(itemRef, {
        order_index: index,
      });
    });

    try {
      await batch.commit().catch(err => { handleFirestoreError(err, OperationType.WRITE, `trips/${selectedTrip.id}/packingList`); throw err; });
    } catch (err) {
      console.error('Failed to reorder packing items', err);
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
                {selectedTrip && (
                  <button
                    onClick={() => {
                      setRenameTripTitle(selectedTrip.title);
                      setIsRenameModalOpen(true);
                    }}
                    className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
                    title="重新命名行程"
                  >
                    <Edit2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                )}
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
                expenses={expenses}
                onAddExpense={handleAddExpense}
                onDeleteExpense={handleDeleteExpense}
                onUpdateExpense={handleUpdateExpense}
                onReorderExpenses={handleReorderExpenses}
                packingItems={packingItems}
                onAddPackingItem={handleAddPackingItem}
                onDeletePackingItem={handleDeletePackingItem}
                onUpdatePackingItem={handleUpdatePackingItem}
                onReorderPackingItems={handleReorderPackingItems}
                activeTab={activeSidebarTab}
                setActiveTab={setActiveSidebarTab}
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
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700"
                >
                  建立行程
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename Trip Modal */}
      {isRenameModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">重新命名行程</h3>
              <button
                onClick={() => setIsRenameModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRenameTrip} className="p-4">
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
                  value={renameTripTitle}
                  onChange={(e) => setRenameTripTitle(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsRenameModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700"
                >
                  儲存
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
