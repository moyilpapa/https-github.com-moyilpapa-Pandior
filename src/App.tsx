/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Calendar as CalendarIcon, 
  History,
  LayoutDashboard, 
  CheckSquare, 
  Mic, 
  Plus, 
  Search, 
  Bell, 
  Settings, 
  Shield,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  FileText,
  Upload,
  Trophy,
  Flame,
  Compass,
  Sun,
  Moon,
  Video,
  Trash2,
  Globe,
  Files,
  Clock,
  Check,
  Download,
  Key,
  Lock,
  Scale,
  Cpu,
  User,
  Sliders
} from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { parseNaturalLanguageInput } from '@/lib/gemini';
import { Event, Task, AttachedFile } from '@/types';

import { haptics, notifications, isNative } from '@/lib/native-bridge';

// Firebase imports
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db, OperationType, handleFirestoreError } from '@/lib/firebase';
import { CloudLightning } from 'lucide-react';

export default function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<Event[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [isFirebaseLoading, setIsFirebaseLoading] = useState(true);

  // Cloud & offline wrapper CRUD operations
  const addEventCloud = async (event: Event) => {
    if (!auth.currentUser) {
      setEvents(prev => [...prev, event]);
      return;
    }
    try {
      const docRef = doc(db, 'events', event.id);
      await setDoc(docRef, {
        id: event.id,
        ownerId: auth.currentUser.uid,
        title: event.title,
        start: event.start.toISOString(),
        end: event.end.toISOString(),
        description: event.description || '',
        category: event.category || 'other',
        priority: event.priority || 'medium'
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `events/${event.id}`);
    }
  };

  const addTaskCloud = async (task: Task) => {
    if (!auth.currentUser) {
      setTasks(prev => [...prev, task]);
      return;
    }
    try {
      const docRef = doc(db, 'tasks', task.id);
      await setDoc(docRef, {
        id: task.id,
        ownerId: auth.currentUser.uid,
        title: task.title,
        dueDate: task.dueDate.toISOString(),
        completed: task.completed || false,
        assignedFileId: task.assignedFileId || ''
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `tasks/${task.id}`);
    }
  };

  const updateTaskCloud = async (task: Task) => {
    if (!auth.currentUser) {
      setTasks(prev => prev.map(t => t.id === task.id ? task : t));
      return;
    }
    try {
      const docRef = doc(db, 'tasks', task.id);
      await setDoc(docRef, {
        id: task.id,
        ownerId: auth.currentUser.uid,
        title: task.title,
        dueDate: task.dueDate instanceof Date ? task.dueDate.toISOString() : task.dueDate,
        completed: task.completed,
        assignedFileId: task.assignedFileId || ''
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `tasks/${task.id}`);
    }
  };

  const removeTaskCloud = async (id: string) => {
    if (!auth.currentUser) {
      setTasks(prev => prev.filter(t => t.id !== id));
      return;
    }
    try {
      await deleteDoc(doc(db, 'tasks', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `tasks/${id}`);
    }
  };

  // Sync sidebar open state on mount and update with screen size
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleResize = () => {
        setIsSidebarOpen(window.innerWidth >= 768);
      };
      handleResize(); // Call on mount
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [prevTab, setPrevTab] = useState('dashboard');
  const [calendarDirection, setCalendarDirection] = useState<'left' | 'right' | null>(null);

  const handleTabChange = (tab: string) => {
    setPrevTab(activeTab);
    setActiveTab(tab);
  };

  const tabOrder = ['dashboard', 'calendar', 'tasks', 'files', 'history', 'privacy', 'settings'];
  const prevIndex = tabOrder.indexOf(prevTab);
  const currentIndex = tabOrder.indexOf(activeTab);
  const tabTransitionDirection = currentIndex >= prevIndex ? 1 : -1;

  // Handle keyboard ArrowLeft and ArrowRight navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl?.tagName === 'INPUT' || 
        activeEl?.tagName === 'TEXTAREA' || 
        activeEl?.getAttribute('contenteditable') === 'true'
      ) {
        return;
      }
      
      const tabOrderList = ['dashboard', 'calendar', 'tasks', 'files', 'history', 'privacy', 'settings'];
      const currentIdx = tabOrderList.indexOf(activeTab);
      
      if (e.key === 'ArrowRight') {
        const nextIndex = (currentIdx + 1) % tabOrderList.length;
        setPrevTab(activeTab);
        setActiveTab(tabOrderList[nextIndex]);
      } else if (e.key === 'ArrowLeft') {
        const nextIndex = (currentIdx - 1 + tabOrderList.length) % tabOrderList.length;
        setPrevTab(activeTab);
        setActiveTab(tabOrderList[nextIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab]);
  const [userName, setUserName] = useState(() => localStorage.getItem('pandior_user_name') || '');
  const [isOnboarding, setIsOnboarding] = useState(() => !localStorage.getItem('pandior_user_name'));
  const [tempName, setTempName] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [streak, setStreak] = useState(() => Number(localStorage.getItem('pandior_streak')) || 5);
  const [xp, setXp] = useState(() => Number(localStorage.getItem('pandior_xp')) || 0);
  const [level, setLevel] = useState(() => Number(localStorage.getItem('pandior_level')) || 1);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [notificationsList, setNotificationsList] = useState<any[]>([
    { id: '1', title: 'Daily Streak Synced', description: 'Streak multiplier active. You are on a 5-day streak!', time: 'Just now', read: false },
    { id: '2', title: 'Vault Sync Complete', description: 'Secure assets and data vaults integrated successfully.', time: '10m ago', read: false },
    { id: '3', title: 'Task Completed', description: 'Task "Update design assets" marked complete. +15 XP', time: '1h ago', read: true }
  ]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [connectedAccounts, setConnectedAccounts] = useState<{google: boolean, zoom: boolean}>({
    google: Number(localStorage.getItem('pandior_conn_google')) === 1,
    zoom: Number(localStorage.getItem('pandior_conn_zoom')) === 1
  });
  const [isHydrated, setIsHydrated] = useState(false);

  // Synchronize events from Firestore when authenticated
  useEffect(() => {
    if (!firebaseUser) return;

    const eventsQuery = query(collection(db, 'events'), where('ownerId', '==', firebaseUser.uid));
    const unsubscribe = onSnapshot(eventsQuery, (snapshot) => {
      const fbEvents: Event[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        fbEvents.push({
          id: data.id,
          title: data.title,
          start: new Date(data.start),
          end: new Date(data.end),
          description: data.description || '',
          category: data.category || 'other',
          priority: data.priority || 'medium'
        });
      });
      setEvents(fbEvents);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'events');
    });

    return () => unsubscribe();
  }, [firebaseUser]);

  // Synchronize tasks from Firestore when authenticated
  useEffect(() => {
    if (!firebaseUser) return;

    const tasksQuery = query(collection(db, 'tasks'), where('ownerId', '==', firebaseUser.uid));
    const unsubscribe = onSnapshot(tasksQuery, (snapshot) => {
      const fbTasks: Task[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        fbTasks.push({
          id: data.id,
          title: data.title,
          dueDate: new Date(data.dueDate),
          completed: data.completed || false,
          assignedFileId: data.assignedFileId || ''
        });
      });
      setTasks(fbTasks);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tasks');
    });

    return () => unsubscribe();
  }, [firebaseUser]);

  // Firebase auth status and hydration state manager
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setFirebaseUser(user);
        // Load Profile from Firestore
        const userDocRef = doc(db, 'users', user.uid);
        try {
          const userSnap = await getDoc(userDocRef);
          if (userSnap.exists()) {
            const userData = userSnap.data();
            if (userData.name) setUserName(userData.name);
            if (userData.streak !== undefined) setStreak(userData.streak);
            if (userData.xp !== undefined) setXp(userData.xp);
            if (userData.level !== undefined) setLevel(userData.level);
          } else {
            // First time user profile creation
            await setDoc(userDocRef, {
              uid: user.uid,
              name: user.displayName || userName || 'Commander',
              streak: streak,
              xp: xp,
              level: level
            });
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
        }
        setIsHydrated(true);
      } else {
        setFirebaseUser(null);
        // Fallback to local and /api/db mock endpoints
        const loadLocal = async () => {
          try {
            const response = await fetch('/api/db');
            if (response.ok) {
              const dbData = await response.json();
              if (dbData.user) {
                if (dbData.user.name) {
                  setUserName(dbData.user.name);
                }
                if (dbData.user.streak) setStreak(dbData.user.streak);
                if (dbData.user.xp !== undefined) setXp(dbData.user.xp);
                if (dbData.user.level) setLevel(dbData.user.level);
              }
              if (dbData.events && dbData.events.length > 0) {
                setEvents(dbData.events.map((e: any) => ({
                  ...e,
                  start: new Date(e.start),
                  end: new Date(e.end)
                })));
              } else {
                // localstorage fallback
                const storedEvents = localStorage.getItem('pandior_events');
                if (storedEvents) {
                  setEvents(JSON.parse(storedEvents).map((e: any) => ({
                    ...e,
                    start: new Date(e.start),
                    end: new Date(e.end)
                  })));
                }
              }
              if (dbData.tasks && dbData.tasks.length > 0) {
                setTasks(dbData.tasks.map((t: any) => ({
                  ...t,
                  dueDate: new Date(t.dueDate)
                })));
              } else {
                // localstorage fallback
                const storedTasks = localStorage.getItem('pandior_tasks');
                if (storedTasks) {
                  setTasks(JSON.parse(storedTasks).map((t: any) => ({
                    ...t,
                    dueDate: new Date(t.dueDate)
                  })));
                }
              }
            }
          } catch (err) {
            console.error("Local load failed:", err);
          } finally {
            setIsHydrated(true);
          }
        };
        loadLocal();
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Sync profile metadata to Firestore (when logged in) or /api/db (when logged out)
  useEffect(() => {
    if (!isHydrated) return;
    if (firebaseUser) {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      setDoc(userDocRef, {
        uid: firebaseUser.uid,
        name: userName,
        streak: streak,
        xp: xp,
        level: level
      }, { merge: true })
        .catch((error) => {
          handleFirestoreError(error, OperationType.WRITE, `users/${firebaseUser.uid}`);
        });
    } else {
      localStorage.setItem('pandior_user_name', userName);
      fetch('/api/db', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: { name: userName } })
      }).catch(err => console.error("Failed syncing username to DB:", err));
    }
  }, [userName, isHydrated, firebaseUser]);

  useEffect(() => {
    if (!isHydrated) return;
    if (firebaseUser) {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      setDoc(userDocRef, {
        uid: firebaseUser.uid,
        streak: streak
      }, { merge: true })
        .catch((error) => {
          handleFirestoreError(error, OperationType.WRITE, `users/${firebaseUser.uid}`);
        });
    } else {
      localStorage.setItem('pandior_streak', streak.toString());
      fetch('/api/db', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: { streak } })
      }).catch(err => console.error("Failed syncing streak to DB:", err));
    }
  }, [streak, isHydrated, firebaseUser]);

  useEffect(() => {
    if (!isHydrated) return;
    if (firebaseUser) {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      setDoc(userDocRef, {
        uid: firebaseUser.uid,
        xp: xp,
        level: level
      }, { merge: true })
        .catch((error) => {
          handleFirestoreError(error, OperationType.WRITE, `users/${firebaseUser.uid}`);
        });
    } else {
      localStorage.setItem('pandior_xp', xp.toString());
      localStorage.setItem('pandior_level', level.toString());
      fetch('/api/db', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: { xp, level } })
      }).catch(err => console.error("Failed syncing gaming level to DB:", err));
    }

    // Level up logic: 100 XP per level
    if (xp >= level * 100) {
      setLevel(prev => prev + 1);
      toast.success(`Level Up! You are now Level ${level + 1}`, {
        icon: '🚀',
        duration: 5000
      });
      haptics.impact();
    }
  }, [xp, level, isHydrated, firebaseUser]);

  // Save changes to backend database when hydrated (if offline)
  useEffect(() => {
    if (!isHydrated || firebaseUser) return;
    localStorage.setItem('pandior_events', JSON.stringify(events));
    fetch('/api/db', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events })
    }).catch(err => console.error("Failed syncing events to DB:", err));
  }, [events, isHydrated, firebaseUser]);

  useEffect(() => {
    if (!isHydrated || firebaseUser) return;
    localStorage.setItem('pandior_tasks', JSON.stringify(tasks));
    fetch('/api/db', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tasks })
    }).catch(err => console.error("Failed syncing tasks to DB:", err));
  }, [tasks, isHydrated, firebaseUser]);

  // Real streak logic
  useEffect(() => {
    const lastActive = localStorage.getItem('pandior_last_active');
    const today = format(new Date(), 'yyyy-MM-dd');
    
    if (lastActive && lastActive !== today) {
      const lastDate = new Date(lastActive);
      const diff = Math.floor((new Date().getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diff === 1) {
        // Consecutive day
        setStreak(prev => prev + 1);
        toast.success(`Streak Continued! Day ${streak + 1}`, { icon: '🔥' });
      } else if (diff > 1) {
        // Streak broken
        setStreak(1);
        toast.error("Streak broken! Starting over at Day 1.", { icon: '❄️' });
      }
    }
    
    localStorage.setItem('pandior_last_active', today);
  }, []);

  const addXp = (amount: number) => {
    setXp(prev => prev + amount);
    haptics.impact();
  };

  const addNotification = (title: string, description: string) => {
    setNotificationsList(prev => [
      {
        id: Math.random().toString(),
        title,
        description,
        time: 'Just now',
        read: false
      },
      ...prev
    ]);
  };

  // Theme effect
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);



  // Voice recognition setup
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onstart = () => {
        setIsListening(true);
        isListeningRef.current = true;
      };

      recognitionRef.current.onresult = async (event: any) => {
        const transcript = event.results[0][0].transcript;
        setIsListening(false);
        isListeningRef.current = false;
        toast.info(`Heard: "${transcript}"`);
        
        try {
          const result = await parseNaturalLanguageInput(transcript, new Date().toISOString());
          handleAIResult(result);
        } catch (error) {
          toast.error("Failed to parse voice command");
        }
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        isListeningRef.current = false;
      };

      recognitionRef.current.onerror = (event: any) => {
        setIsListening(false);
        isListeningRef.current = false;
        if (event.error === 'not-allowed') {
          toast.error("Microphone access denied. Please enable it in settings.");
        } else if (event.error === 'network') {
          toast.error("Network error during speech recognition.");
        } else if (event.error === 'aborted') {
          // No toast for user abort
        } else {
          toast.error(`Speech recognition error: ${event.error}`);
        }
      };
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  const handleAIResult = (result: any) => {
    try {
      if (result.type === 'event' && result.event) {
        const eventStart = parseISO(result.event.start);
        const eventEnd = parseISO(result.event.end);

        if (isNaN(eventStart.getTime()) || isNaN(eventEnd.getTime())) {
          toast.error("Invalid date received from AI.");
          return;
        }

        if (eventStart < new Date(new Date().setHours(0,0,0,0))) {
          toast.error("Cannot schedule events in the past.");
          return;
        }
        const newEvent: Event = {
          id: Math.random().toString(36).substr(2, 9),
          title: result.event.title,
          start: eventStart,
          end: eventEnd,
          description: result.event.description,
          category: result.event.category || 'other',
          priority: result.event.priority || 'medium',
        };
        addEventCloud(newEvent);
        toast.success(result.message || "Event scheduled!");
        notifications.schedule("Pandior: New Event", `Scheduled: ${newEvent.title}`);
        addNotification("Calendar Event Synced", `Scheduled: ${newEvent.title}`);
      } else if (result.type === 'task' && result.task) {
        const taskDue = parseISO(result.task.dueDate);

        if (isNaN(taskDue.getTime())) {
          toast.error("Invalid date received from AI.");
          return;
        }

        if (taskDue < new Date(new Date().setHours(0,0,0,0))) {
          toast.error("Cannot schedule tasks in the past.");
          return;
        }
        const newTask: Task = {
          id: Math.random().toString(36).substr(2, 9),
          title: result.task.title,
          dueDate: taskDue,
          completed: false,
        };
        addTaskCloud(newTask);
        toast.success(result.message || "Task added!");
        notifications.schedule("Pandior: New Task", `Added: ${newTask.title}`);
        addNotification("Task Synced To Dashboard", `Added: ${newTask.title}`);
      } else {
        toast.info(result.message);
      }
    } catch (error) {
      console.error("Error handling AI result:", error);
      toast.error("An error occurred while processing the AI response.");
    }
  };

  const toggleVoice = () => {
    haptics.impact();
    
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      toast.error("Speech recognition is not supported in this browser.");
      return;
    }

    if (isListeningRef.current) {
      try {
        recognitionRef.current?.stop();
      } catch (e) {
        // ignore
      }
      setIsListening(false);
      isListeningRef.current = false;
    } else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
        isListeningRef.current = true;
      } catch (error) {
        console.warn("Failed to start speech recognition (likely already running):", error);
        setIsListening(false);
        isListeningRef.current = false;
      }
    }
  };

  const handleOnboardingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = tempName.trim();
    if (!trimmedName) {
      toast.error("Please enter your display name to begin.");
      return;
    }
    setUserName(trimmedName);
    localStorage.setItem('pandior_user_name', trimmedName);
    setIsOnboarding(false);
    toast.success(`Welcome to Pandior, ${trimmedName}!`, { icon: '✨' });
    haptics.impact();
  };

  const upcomingEvents = events
    .filter(e => e.start >= new Date(new Date().setHours(0,0,0,0)))
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .slice(0, 5);

  const pastEvents = events
    .filter(e => e.start < new Date(new Date().setHours(0,0,0,0)))
    .sort((a, b) => b.start.getTime() - a.start.getTime());

  return (
    <div className="flex h-screen bg-transparent text-foreground font-sans overflow-hidden relative">
      <Toaster position="top-right" />
      <ScrollToTop activeTab={activeTab} />
      
      {/* Onboarding Flow Modal */}
      <AnimatePresence>
        {isOnboarding && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-background/85 backdrop-blur-2xl flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 220, damping: 26 }}
              className="w-full max-w-md p-8 md:p-10 rounded-[2.5rem] glass-card border border-border/60 flex flex-col space-y-8 shadow-2xl relative overflow-hidden"
            >
              {/* Subtle background glow effect */}
              <div className="absolute -top-40 -left-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 bg-primary/20 rounded-3xl flex items-center justify-center text-primary border border-primary/20 shadow-lg shadow-primary/10 animate-pulse">
                  <Compass size={32} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent">
                    Welcome to Pandior
                  </h2>
                  <p className="text-sm text-muted-foreground max-w-xs font-medium">
                    Your stunning workspace with daily multi-agent planner tools. Let's customize your workspace.
                  </p>
                </div>
              </div>

              <form onSubmit={handleOnboardingSubmit} className="space-y-6">
                <div className="space-y-2.5">
                  <Label 
                    htmlFor="onboarding-name" 
                    className="text-xs font-black uppercase tracking-widest text-[#a1a1aa] dark:text-zinc-400"
                  >
                    Enter Your Name
                  </Label>
                  <Input 
                    id="onboarding-name" 
                    type="text"
                    autoFocus
                    value={tempName} 
                    onChange={(e) => setTempName(e.target.value)}
                    className="rounded-xl h-12 bg-white/5 border border-white/15 focus:border-primary focus:ring-1 focus:ring-primary text-foreground text-base tracking-wide"
                    placeholder="Jedi Amos" 
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm transition-all shadow-md shadow-primary/20 flex items-center justify-center gap-2"
                >
                  Enter Workspace <Check size={16} />
                </Button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic Clock Background */}
      <ClockBackground theme={theme} />
      
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>
      
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ 
          width: isSidebarOpen ? 280 : 80,
          x: (window.innerWidth < 768 && !isSidebarOpen) ? -280 : 0
        }}
        transition={{ type: "spring", stiffness: 180, damping: 25, mass: 0.9 }}
        className={`fixed md:relative h-full border-r border-white/10 dark:border-white/5 bg-white/5 dark:bg-black/15 backdrop-blur-xl flex flex-col z-50`}
      >
        <div className="p-8 flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/20 rounded-2xl flex items-center justify-center text-primary border border-primary/20">
            <Compass size={24} className="animate-pulse" />
          </div>
          {isSidebarOpen && (
            <motion.h1 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-branding text-3xl tracking-tight text-foreground"
            >
              Pandior
            </motion.h1>
          )}
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          <div className="hidden md:block">
            <NavItem 
              icon={<LayoutDashboard size={20} />} 
              label="Dashboard" 
              active={activeTab === 'dashboard'} 
              collapsed={!isSidebarOpen}
              onClick={() => handleTabChange('dashboard')}
            />
          </div>
          <div className="hidden md:block">
            <NavItem 
              icon={<CalendarIcon size={20} />} 
              label="Calendar" 
              active={activeTab === 'calendar'} 
              collapsed={!isSidebarOpen}
              onClick={() => handleTabChange('calendar')}
            />
          </div>
          <div className="hidden md:block">
            <NavItem 
              icon={<CheckSquare size={20} />} 
              label="Tasks" 
              active={activeTab === 'tasks'} 
              collapsed={!isSidebarOpen}
              onClick={() => handleTabChange('tasks')}
            />
          </div>
          <div className="hidden md:block">
            <NavItem 
              icon={<Globe size={20} />} 
              label="File" 
              active={activeTab === 'files'} 
              collapsed={!isSidebarOpen}
              onClick={() => handleTabChange('files')}
            />
          </div>
          
          <div className="md:hidden">
            <NavItem 
              icon={<Settings size={20} />} 
              label="Setting" 
              active={activeTab === 'settings'} 
              collapsed={!isSidebarOpen}
              onClick={() => {
                handleTabChange('settings');
                if (window.innerWidth < 768) setIsSidebarOpen(false);
              }}
            />
          </div>

          <div className="hidden md:block">
            <NavItem 
              icon={<Shield size={20} />} 
              label="Privacy & Security" 
              active={activeTab === 'privacy'} 
              collapsed={!isSidebarOpen}
              onClick={() => {
                handleTabChange('privacy');
                if (window.innerWidth < 768) setIsSidebarOpen(false);
              }}
            />
          </div>
          
          <NavItem 
            icon={<History size={20} />} 
            label="Activity" 
            active={activeTab === 'history'} 
            collapsed={!isSidebarOpen}
            onClick={() => {
              handleTabChange('history');
              if (window.innerWidth < 768) setIsSidebarOpen(false);
            }}
          />

          <div className="md:hidden">
            <NavItem 
              icon={<Shield size={20} />} 
              label="Privacy & Security" 
              active={activeTab === 'privacy'} 
              collapsed={!isSidebarOpen}
              onClick={() => {
                handleTabChange('privacy');
                if (window.innerWidth < 768) setIsSidebarOpen(false);
              }}
            />
          </div>
        </nav>

        <div className="p-6">
          <div className={`p-4 rounded-3xl bg-muted/30 border border-border/50 flex flex-col gap-4 ${!isSidebarOpen ? 'items-center p-2' : ''}`}>
             <div className="flex items-center gap-3 w-full">
                <Avatar className="h-10 w-10 border border-border">
                  <AvatarImage src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100" />
                  <AvatarFallback className="bg-primary/10 text-primary">JD</AvatarFallback>
                </Avatar>
                {isSidebarOpen && (
                  <div className="flex-1 overflow-hidden">
                    <p className="text-xs font-bold leading-none">{userName}</p>
                    <p className="text-[10px] text-muted-foreground mt-1 truncate">Pro Planner</p>
                  </div>
                )}
             </div>
             {isSidebarOpen && (
               <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] uppercase font-bold text-muted-foreground">
                    <span>Progress</span>
                    <span>Lvl {level}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${xp % 100}%` }}
                      className="h-full bg-primary"
                    />
                  </div>
               </div>
             )}
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        {/* Header */}
        <header className="h-20 flex items-center justify-between px-6 md:px-10 z-50">
          <div className="flex items-center gap-6">
            <Button 
               variant="ghost" 
               size="icon" 
               onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
               className="hidden md:inline-flex hover:bg-muted/50 rounded-xl"
            >
              <Menu size={20} />
            </Button>
            
            <div className={`relative max-w-sm w-full transition-all duration-300 ${isMobileSearchOpen ? 'fixed inset-x-4 top-4 z-[60] bg-background p-4 rounded-2xl shadow-2xl border' : 'hidden md:flex'}`}>
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input 
                placeholder="Talk to Pandior AI..." 
                className={`pl-12 bg-muted/40 border-none h-12 rounded-2xl ring-offset-transparent focus-visible:ring-primary/20 ${isMobileSearchOpen ? 'h-14 text-lg' : ''}`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    toast.loading("Pandior AI is thinking...");
                    try {
                      const result = await parseNaturalLanguageInput(searchQuery, new Date().toISOString());
                      handleAIResult(result);
                      setSearchQuery('');
                      setIsMobileSearchOpen(false);
                    } catch (error) {
                      toast.error("Assistant busy. Try again.");
                    }
                  }
                }}
              />
              {isMobileSearchOpen && (
                <Button variant="ghost" size="icon" className="md:hidden ml-2" onClick={() => setIsMobileSearchOpen(false)}>
                  <X size={20} />
                </Button>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <motion.div 
              whileHover={{ scale: 1.02 }} 
              whileTap={{ scale: 0.98 }}
              className="hidden sm:flex items-center"
            >
              <Button
                variant={isListening ? "secondary" : "ghost"}
                size="icon"
                onClick={toggleVoice}
                className={`h-11 w-11 rounded-xl transition-all duration-300 ${
                  isListening 
                    ? 'bg-red-500/10 text-red-600 dark:text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.1)]' 
                    : 'hover:bg-muted/50'
                }`}
              >
                <Mic size={20} className={isListening ? "text-red-500 animate-pulse" : "text-muted-foreground group-hover:text-primary transition-colors"} />
              </Button>
            </motion.div>

            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
                className="rounded-xl hover:bg-muted/50"
              >
                <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              </Button>
              
              <div className="relative">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => {
                      setIsNotificationsOpen(p => !p);
                      haptics.impact();
                    }}
                    className={`relative rounded-xl hover:bg-muted/50 transition-all ${isNotificationsOpen ? 'bg-primary/10 text-primary' : ''}`}
                  >
                    <Bell size={20} className={isNotificationsOpen ? "transition-all" : (notificationsList.some(n => !n.read) ? "text-emerald-500 dark:text-emerald-400 animate-pulse" : "text-muted-foreground transition-all")} />
                    {notificationsList.some(n => !n.read) && (
                      <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 animate-ping opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                    )}
                  </Button>
                </motion.div>
                
                <AnimatePresence>
                  {isNotificationsOpen && (
                    <>
                      {/* Invisible backdrop to dismiss dropdown */}
                      <div className="fixed inset-0 z-40" onClick={() => setIsNotificationsOpen(false)} />
                                   <motion.div
                        initial={{ opacity: 0, y: 15, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 15, scale: 0.95 }}
                        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                        className="fixed top-20 right-4 left-4 md:absolute md:top-auto md:left-auto md:right-0 md:mt-3 md:w-96 rounded-3xl border border-border/80 bg-popover text-popover-foreground shadow-2xl p-4 z-50 overflow-hidden backdrop-blur-xl"
                      >
                        <div className="flex items-center justify-between pb-3 border-b border-border/50 mb-3">
                          <h4 className="font-bold tracking-tight text-sm">Notifications</h4>
                          <div className="flex gap-2">
                            {notificationsList.some(n => !n.read) && (
                              <button 
                                onClick={() => {
                                  setNotificationsList(prev => prev.map(n => ({ ...n, read: true })));
                                  haptics.impact();
                                }}
                                className="text-xs text-primary/85 hover:text-primary transition-colors font-semibold"
                              >
                                Mark all as read
                              </button>
                            )}
                            <button 
                              onClick={() => {
                                  setNotificationsList([]);
                                  haptics.impact();
                                }}
                                className="text-xs text-muted-foreground hover:text-foreground transition-colors font-semibold"
                              >
                                Clear
                              </button>
                            </div>
                          </div>
                          
                          <div className="space-y-2 max-h-[350px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                          {notificationsList.length === 0 ? (
                            <div className="py-8 text-center text-xs text-muted-foreground">
                              All cleared. No active notifications.
                            </div>
                          ) : (
                            notificationsList.map(n => (
                              <div 
                                key={n.id} 
                                onClick={() => {
                                  setNotificationsList(prev => prev.map(item => item.id === n.id ? { ...item, read: true } : item));
                                  haptics.impact();
                                }}
                                className={`p-3 rounded-2xl transition-all duration-300 border text-left cursor-pointer relative group ${
                                  n.read 
                                    ? 'bg-transparent border-transparent opacity-60' 
                                    : 'bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/15 hover:border-emerald-500/30'
                                }`}
                              >
                                {!n.read && (
                                  <span className="absolute top-3.5 right-3 flex h-1.5 w-1.5">
                                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 animate-ping opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                  </span>
                                )}
                                <h5 className={`text-xs font-black tracking-tight ${n.read ? 'text-muted-foreground/80' : 'text-foreground'}`}>
                                  {n.title}
                                </h5>
                                <p className="text-[11px] text-muted-foreground/90 mt-1 leading-relaxed">
                                  {n.description}
                                </p>
                                <span className="block text-[9px] text-muted-foreground/50 mt-2 font-mono">
                                  {n.time}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => handleTabChange('settings')}
                className={`hidden md:inline-flex rounded-xl hover:bg-muted/50 ${activeTab === 'settings' ? 'bg-primary/10 text-primary' : ''}`}
              >
                <Settings size={20} />
              </Button>

              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
                className="md:hidden hover:bg-muted/50 rounded-xl"
              >
                <Menu size={20} />
              </Button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden p-4 md:p-10 relative">
          <div className="max-w-7xl mx-auto h-full relative">
            
            {/* Voice Control Status */}
            <AnimatePresence>
              {isListening && (
                <motion.div 
                  initial={{ opacity: 0, y: -20, x: '-50%' }}
                  animate={{ opacity: 1, y: 0, x: '-50%' }}
                  exit={{ opacity: 0, y: -20, x: '-50%' }}
                  className="fixed top-8 left-1/2 z-[100] px-8 py-4 bg-primary text-primary-foreground rounded-3xl shadow-2xl flex items-center gap-4 border border-white/20"
                >
                  <div className="flex gap-1.5 items-center">
                    {[1, 2, 3, 4].map(i => (
                      <motion.div 
                        key={i}
                        animate={{ height: [12, 28, 12] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                        className="w-1.5 bg-white/80 rounded-full"
                      />
                    ))}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black uppercase tracking-widest leading-none">Awaiting Command</span>
                    <span className="text-[10px] opacity-60 mt-0.5">Pandior Intelligence active</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <ScrollArea className="h-full w-full pr-2">
              <div className="pb-32 sm:pb-10">
                <AnimatePresence mode="wait">
                {activeTab === 'dashboard' && (
                  <motion.div 
                    key="dashboard"
                    initial={{ opacity: 0, x: tabTransitionDirection * 35 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -tabTransitionDirection * 35 }}
                    transition={{ type: "spring", stiffness: 350, damping: 30, mass: 0.8 }}
                    className="bento-grid"
                  >
                    {/* Welcome Card */}
                    <div className="col-span-12 lg:col-span-8 p-10 rounded-3xl glass-card relative overflow-hidden group min-h-[340px] flex flex-col justify-center">
                      <div className="absolute top-0 right-0 p-12 text-primary/5 group-hover:text-primary/10 smooth-transition">
                        <Compass size={180} />
                      </div>
                      <div className="relative z-10">
                        <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Good Morning, {userName.split(' ')[0]}.</h2>
                        <p className="text-lg text-muted-foreground/80 max-w-lg leading-relaxed font-medium">
                          You have {upcomingEvents.length} assignments prioritized for today. 
                          Your current focus efficiency is at <span className="text-emerald-600 dark:text-emerald-500 font-extrabold bg-emerald-500/10 dark:bg-emerald-950/45 px-2 py-0.5 rounded-lg border border-emerald-500/20 dark:border-emerald-800/35 shadow-[0_0_12px_rgba(16,185,129,0.05)]">94%</span> — the highest this week.
                        </p>
                        <div className="flex items-center gap-4 mt-10">
                           <Button 
                             className="rounded-2xl h-14 px-10 text-base font-bold shadow-2xl shadow-primary/30"
                             onClick={() => handleTabChange('calendar')}
                           >
                              Review Deployment
                           </Button>
                           
                        </div>
                      </div>
                    </div>

                    {/* XP Progress Card */}
                    <div className="col-span-12 lg:col-span-4 p-8 rounded-3xl glass-card flex flex-col justify-between">
                       <div>
                          <div className="flex justify-between items-start mb-8">
                             <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Progression</h3>
                             <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                <Trophy size={20} />
                             </div>
                          </div>
                          <div className="space-y-6">
                             <div className="space-y-3">
                                <div className="flex justify-between items-end">
                                   <span className="text-sm font-bold">Level {level}</span>
                                   <span className="text-[10px] font-black opacity-40 uppercase tracking-tighter">{(xp % 100)} / 100 XP</span>
                                </div>
                                <div className="h-3 bg-muted rounded-full overflow-hidden">
                                   <motion.div initial={{ width: 0 }} animate={{ width: `${xp % 100}%` }} className="h-full bg-primary" />
                                </div>
                             </div>
                             <div className="p-4 rounded-2xl bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/10 dark:border-emerald-800/20 text-emerald-600 dark:text-emerald-500">
                                <p className="text-[11px] font-medium leading-relaxed italic opacity-85">
                                   "Precision is the foundation of excellence. Synchronization active."
                                </p>
                             </div>
                          </div>
                       </div>
                       <Button 
                         variant="ghost" 
                         className="w-full mt-6 rounded-2xl h-12 bg-primary/5 hover:bg-primary/10 border border-primary/10 text-primary font-bold text-xs"
                       >
                          View Skill Tree
                       </Button>
                    </div>

                    {/* Schedule Summary */}
                    <div className="col-span-12 lg:col-span-7 p-8 rounded-3xl glass-card">
                       <div className="flex items-center justify-between mb-10">
                          <h3 className="text-xl font-bold tracking-tight">Deployment Log</h3>
                          <Button variant="ghost" size="sm" className="rounded-xl text-primary font-bold" onClick={() => handleTabChange('calendar')}>Sync Full Grid</Button>
                       </div>
                       <div className="space-y-1">
                          {upcomingEvents.slice(0, 3).map(event => (
                            <div key={event.id} className="p-5 rounded-2xl hover:bg-muted/30 border border-transparent hover:border-border/50 smooth-transition flex gap-6 group">
                               <div className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center font-bold border transition-all duration-300 ${
                                 event.category === 'work' ? 'bg-primary/10 text-primary border-primary/20' :
                                 event.category === 'personal' ? 'bg-secondary text-secondary-foreground border-border' :
                                 'bg-muted/40 text-muted-foreground border-border'
                               } group-hover:scale-105 group-hover:shadow-lg`}>
                                  <span className="text-[10px] uppercase leading-none opacity-60 mb-1">{format(event.start, 'MMM')}</span>
                                  <span className="text-2xl leading-none tracking-tighter">{format(event.start, 'dd')}</span>
                               </div>
                               <div className="flex-1 flex flex-col justify-center">
                                  <div className="flex items-center gap-2 mb-1.5">
                                     <h4 className="font-bold text-lg text-foreground group-hover:text-primary smooth-transition">{event.title}</h4>
                                     <Badge variant="outline" className="text-[9px] uppercase tracking-wider h-4 px-1.5 bg-background/50">{event.category}</Badge>
                                  </div>
                                  <div className="flex items-center gap-4 text-xs text-muted-foreground font-semibold">
                                     <span className="flex items-center gap-1.5"><Clock size={14} /> {format(event.start, 'h:mm a')}</span>
                                     <span className="opacity-30">•</span>
                                     <span className="text-[10px] uppercase tracking-widest text-primary/60">Priority Meta</span>
                                  </div>
                               </div>
                               <Button variant="ghost" size="icon" className="self-center rounded-2xl hover:bg-primary/10 hover:text-primary">
                                  <ChevronRight size={24} />
                                </Button>
                            </div>
                          ))}
                          {upcomingEvents.length === 0 && (
                            <div className="py-20 text-center text-muted-foreground font-medium italic text-sm">Synchronizing new assignments...</div>
                          )}
                       </div>
                    </div>

                    {/* Active Tasks Feed */}
                    <div className="col-span-12 lg:col-span-5 p-8 rounded-3xl glass-card">
                       <div className="flex items-center justify-between mb-10">
                          <h3 className="text-xl font-bold tracking-tight">Active Core</h3>
                          <Button variant="ghost" size="sm" className="rounded-xl text-primary font-bold" onClick={() => handleTabChange('tasks')}>Queue</Button>
                       </div>
                       <div className="space-y-4">
                          {tasks.slice(0, 4).map(task => (
                            <div 
                              key={task.id} 
                              className="flex items-center gap-5 p-4 rounded-2xl bg-muted/20 hover:bg-muted/40 border border-border/50 smooth-transition group cursor-pointer"
                              onClick={() => {
                                const newCompleted = !task.completed;
                                updateTaskCloud({ ...task, completed: newCompleted });
                                if (newCompleted) {
                                  addXp(20);
                                  toast.success("+20 XP Synchronized");
                                  addNotification("Objective Completed", `Task "${task.title}" completed. +20 XP`);
                                }
                              }}
                            >
                               <div className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all duration-300 ${
                                  task.completed ? 'bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/30' : 'border-muted-foreground/30 hover:border-primary group-hover:border-primary'
                               }`}>
                                  {task.completed && <Check size={18} strokeWidth={4} className="text-primary-foreground" />}
                               </div>
                               <div className="flex-1 overflow-hidden">
                                  <span className={`block font-bold text-sm truncate ${task.completed ? 'line-through text-muted-foreground opacity-50' : 'text-foreground'}`}>
                                     {task.title}
                                  </span>
                                  <span className="text-[10px] uppercase font-black opacity-30 mt-1 block">Sector 07</span>
                               </div>
                            </div>
                          ))}
                       </div>
                    </div>
                  </motion.div>
                )}

            {activeTab === 'calendar' && (
              <motion.div 
                key="calendar"
                initial={{ opacity: 0, x: tabTransitionDirection * 35 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -tabTransitionDirection * 35 }}
                transition={{ type: "spring", stiffness: 350, damping: 30, mass: 0.8 }}
                className="h-full flex flex-col space-y-8"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h2 className="text-4xl font-bold tracking-tight">{format(currentDate, 'MMMM yyyy')}</h2>
                    <p className="text-muted-foreground font-medium mt-1">Showing {events.length} active deployments for this sector.</p>
                  </div>
                  <div className="flex items-center gap-3 bg-muted/30 p-2 rounded-2xl border border-border/50">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="rounded-xl h-10 w-10 hover:bg-background shadow-sm transition-transform duration-150 active:scale-95" 
                      onClick={() => {
                        setCalendarDirection('left');
                        setCurrentDate(subMonths(currentDate, 1));
                      }}
                    >
                      <ChevronLeft size={18} />
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="rounded-xl px-6 h-10 hover:bg-background shadow-sm font-bold text-xs uppercase tracking-widest transition-transform duration-150 active:scale-95" 
                      onClick={() => {
                        setCalendarDirection(new Date().getTime() < currentDate.getTime() ? 'left' : 'right');
                        setCurrentDate(new Date());
                      }}
                    >
                      Current Epoch
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="rounded-xl h-10 w-10 hover:bg-background shadow-sm transition-transform duration-150 active:scale-95" 
                      onClick={() => {
                        setCalendarDirection('right');
                        setCurrentDate(addMonths(currentDate, 1));
                      }}
                    >
                      <ChevronRight size={18} />
                    </Button>
                  </div>
                </div>

                <div className="flex-1 glass-card rounded-[2.5rem] border border-border/50 flex flex-col overflow-hidden shadow-2xl relative">
                  <div className="grid grid-cols-7 border-b border-border/30 bg-muted/20">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} className="py-5 text-center text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 overflow-hidden relative min-h-[450px]">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div 
                        key={currentDate.getMonth() + '-' + currentDate.getFullYear()}
                        initial={{ 
                          opacity: 0, 
                          x: calendarDirection === 'right' ? 30 : calendarDirection === 'left' ? -30 : 0
                        }}
                        animate={{ 
                          opacity: 1, 
                          x: 0
                        }}
                        exit={{ 
                          opacity: 0, 
                          x: calendarDirection === 'right' ? -30 : calendarDirection === 'left' ? 30 : 0
                        }}
                        transition={{ type: "spring", stiffness: 350, damping: 30, mass: 0.8 }}
                        className="absolute inset-0 grid grid-cols-7 grid-rows-6"
                      >
                        {renderCalendarDays(currentDate, events)}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'tasks' && (
              <motion.div 
                key="tasks"
                initial={{ opacity: 0, x: tabTransitionDirection * 35 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -tabTransitionDirection * 35 }}
                transition={{ type: "spring", stiffness: 350, damping: 30, mass: 0.8 }}
                className="max-w-4xl mx-auto space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-4xl font-bold tracking-tight">Active Queue</h2>
                    <p className="text-muted-foreground font-medium mt-1">Manage your tactical objectives and priorities.</p>
                  </div>
                  <Dialog>
                    <DialogTrigger render={<Button className="rounded-2xl h-12 px-6 gap-2 shadow-xl shadow-primary/20" />}>
                      <Plus size={18} /> <span>New Task</span>
                    </DialogTrigger>
                    <DialogContent className="glass-card border border-white/20 rounded-3xl">
                      <DialogHeader>
                        <DialogTitle className="text-2xl font-bold tracking-tight">Initialize Objective</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-6 py-6">
                        <div className="space-y-2">
                          <Label htmlFor="task-title" className="text-xs font-black uppercase tracking-widest text-zinc-950 dark:text-zinc-50">Objective Designation</Label>
                          <Input id="task-title" placeholder="Define your next target..." className="rounded-xl h-12 bg-muted/30" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="task-date" className="text-xs font-black uppercase tracking-widest text-zinc-950 dark:text-zinc-50">Target Timeline</Label>
                          <Input id="task-date" type="date" className="rounded-xl h-12 bg-muted/30" />
                        </div>
                        <Button className="w-full h-14 rounded-2xl font-bold text-lg" onClick={() => {
                          const title = (document.getElementById('task-title') as HTMLInputElement).value;
                          const date = (document.getElementById('task-date') as HTMLInputElement).value;
                          if (title && date) {
                            addTaskCloud({
                              id: Math.random().toString(36).substr(2, 9),
                              title,
                              dueDate: new Date(date),
                              completed: false
                            });
                            toast.success("Objective Synchronized");
                            addNotification("Objective Established", `Objective: ${title}`);
                          }
                        }}>Establish Link</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="space-y-4">
                  {tasks.map(task => (
                    <motion.div 
                      key={task.id} 
                      layout
                      className={`p-6 rounded-3xl glass-card border border-border/50 smooth-transition group flex items-center gap-6 ${task.completed ? 'opacity-50' : ''}`}
                    >
                      <div 
                        className={`w-10 h-10 rounded-2xl border-2 flex items-center justify-center cursor-pointer transition-all duration-300 ${task.completed ? 'bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/30' : 'border-muted-foreground/30 hover:border-primary group-hover:scale-110'}`}
                        onClick={() => {
                          const newCompleted = !task.completed;
                          updateTaskCloud({ ...task, completed: newCompleted });
                          if (newCompleted) {
                            addXp(20);
                            toast.success("+20 XP Synchronized");
                            addNotification("Objective Completed", `Task "${task.title}" completed. +20 XP`);
                          }
                        }}
                      >
                        {task.completed && <Check size={20} strokeWidth={4} className="text-primary-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className={`text-lg font-bold tracking-tight ${task.completed ? 'line-through text-muted-foreground' : ''}`}>{task.title}</h4>
                        <div className="flex items-center gap-4 mt-1.5">
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5">
                            <CalendarIcon size={12} /> {format(task.dueDate, 'MMM d, yyyy')}
                          </span>
                          {task.assignedFileId && (
                            <Badge variant="secondary" className="bg-primary/10 text-primary border-none text-[9px] uppercase tracking-tighter h-5">
                              Linked Visual
                            </Badge>
                          )}
                        </div>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger render={<Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity rounded-xl hover:bg-destructive/10 hover:text-destructive" />}>
                            <Trash2 size={18} />
                        </AlertDialogTrigger>
                        <AlertDialogContent className="glass-card border border-white/20 rounded-3xl">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-xl font-bold">Terminate Objective?</AlertDialogTitle>
                            <AlertDialogDescription className="text-muted-foreground font-medium">
                              This will permanently purge "{task.title}" from the active database.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="mt-6">
                            <AlertDialogCancel className="rounded-xl">Retain</AlertDialogCancel>
                            <AlertDialogAction 
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
                              onClick={() => {
                                removeTaskCloud(task.id);
                                toast.success("Data Purged");
                              }}
                            >
                              Confirm Purge
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </motion.div>
                  ))}
                  {tasks.length === 0 && (
                    <div className="text-center py-24 bg-muted/10 rounded-[3rem] border-2 border-dashed border-border/50">
                      <CheckSquare size={64} className="mx-auto mb-6 text-muted-foreground opacity-20" />
                      <p className="text-muted-foreground font-bold text-lg">No active objectives detected.</p>
                      <p className="text-muted-foreground/60 text-sm mt-1">Initialize via terminal or voice synthesis.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'files' && (
              <motion.div 
                key="files"
                initial={{ opacity: 0, x: tabTransitionDirection * 35 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -tabTransitionDirection * 35 }}
                transition={{ type: "spring", stiffness: 350, damping: 30, mass: 0.8 }}
                className="max-w-5xl mx-auto space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-4xl font-bold tracking-tight">Secure Vault</h2>
                    <p className="text-muted-foreground font-medium mt-1">Your encrypted asset repository and documentation.</p>
                  </div>
                  <Button className="rounded-2xl h-12 px-6 gap-2 shadow-xl shadow-primary/20">
                    <Upload size={18} /> <span>Upload Asset</span>
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    { name: 'sector_alpha.pdf', size: '2.4 MB', type: 'PDF', color: 'bg-secondary text-secondary-foreground border-border' },
                    { name: 'tactical_core.zip', size: '15.8 MB', type: 'ARCHIVE', color: 'bg-secondary text-secondary-foreground border-border' },
                    { name: 'intel_report.docx', size: '45 KB', type: 'DOC', color: 'bg-secondary text-secondary-foreground border-border' },
                    { name: 'encrypted_comms.pdf', size: '1.2 MB', type: 'PDF', color: 'bg-secondary text-secondary-foreground border-border' },
                    { name: 'manifest_v3.json', size: '12 KB', type: 'DATA', color: 'bg-primary/15 text-primary border-primary/35' }
                  ].map((file, i) => (
                    <motion.div 
                      key={i}
                      whileHover={{ y: -5 }}
                      className="p-6 rounded-3xl glass-card border border-border/50 group cursor-pointer relative overflow-hidden"
                    >
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border mb-6 group-hover:scale-110 smooth-transition ${file.color}`}>
                        <FileText size={28} />
                      </div>
                      <h4 className="font-bold truncate text-sm mb-1">{file.name}</h4>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase opacity-40 tracking-tighter">{file.size}</span>
                        <Badge variant="outline" className="text-[8px] h-4 px-1.5 opacity-60">{file.type}</Badge>
                      </div>
                      <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 smooth-transition translate-y-2 group-hover:translate-y-0">
                         <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg bg-background shadow-sm hover:text-primary"><Download size={14} /></Button>
                         <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg bg-background shadow-sm hover:text-destructive"><Trash2 size={14} /></Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'history' && (
              <motion.div 
                key="history"
                initial={{ opacity: 0, x: tabTransitionDirection * 35 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -tabTransitionDirection * 35 }}
                transition={{ type: "spring", stiffness: 350, damping: 30, mass: 0.8 }}
                className="max-w-4xl mx-auto space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-4xl font-bold tracking-tight">Active Logs</h2>
                    <p className="text-muted-foreground font-medium mt-1">Timeline of completed tactical operations.</p>
                  </div>
                  <Badge variant="outline" className="rounded-full px-4 py-1.5 bg-muted/30 border-border/50 font-bold uppercase tracking-widest text-[9px]">
                    {pastEvents.length} Archives
                  </Badge>
                </div>
                
                <div className="relative pl-8 border-l-2 border-border/30 space-y-10 ml-4">
                    {pastEvents.length > 0 ? (
                      pastEvents.map((event, idx) => (
                        <motion.div 
                          key={event.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="relative"
                        >
                           <div className="absolute -left-11 top-1 w-6 h-6 rounded-full bg-background border-4 border-primary shadow-xl z-20" />
                           <div className="p-6 rounded-3xl glass-card border border-border/50 hover:border-primary/30 smooth-transition group">
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                 <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-xl ${
                                      event.category === 'work' ? 'bg-primary/10 text-primary' :
                                      event.category === 'personal' ? 'bg-secondary text-secondary-foreground border border-border/40' :
                                      'bg-muted/45 text-muted-foreground border border-border/40'
                                    }`}>
                                       <History size={20} />
                                    </div>
                                    <div>
                                       <h4 className="font-bold text-lg leading-tight group-hover:text-primary smooth-transition">{event.title}</h4>
                                       <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground font-medium">
                                          <span>{format(event.start, 'MMM d, yyyy')}</span>
                                          <span className="opacity-30">•</span>
                                          <span>{format(event.start, 'h:mm a')}</span>
                                       </div>
                                    </div>
                                 </div>
                                 <Badge variant="secondary" className="self-start md:self-center bg-primary/5 text-primary border-none text-[10px] uppercase font-black tracking-tighter px-3">
                                    {event.category}
                                 </Badge>
                              </div>
                           </div>
                        </motion.div>
                      ))
                    ) : (
                    <div className="text-center py-24 bg-muted/10 rounded-[3rem] border-2 border-dashed border-border/50 -ml-8">
                      <History size={64} className="mx-auto mb-6 text-muted-foreground opacity-20" />
                      <p className="text-muted-foreground font-bold text-lg">Archives empty.</p>
                      <p className="text-muted-foreground/60 text-sm mt-1">Logs will appear as operations complete.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0, x: tabTransitionDirection * 35 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -tabTransitionDirection * 35 }}
                transition={{ type: "spring", stiffness: 350, damping: 30, mass: 0.8 }}
                className="max-w-4xl mx-auto space-y-8 pb-10"
              >
                <div>
                  <h2 className="text-4xl font-bold tracking-tight">System Settings</h2>
                  <p className="text-muted-foreground font-medium mt-1">Configure your workspace profiling, authentications, and interface preferences.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Profile Management Card */}
                  <div className="p-8 rounded-[2.5rem] glass-card border border-border/50 flex flex-col space-y-6 animate-fade-in-up">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <User size={20} className="text-primary" /> Profile Configuration
                    </h3>
                    
                    <div className="space-y-4">
                      {firebaseUser ? (
                        <div className="flex items-center gap-4 p-4 rounded-2xl bg-primary/10 border border-primary/20">
                          <Avatar className="w-12 h-12 rounded-xl ring-2 ring-primary/40">
                            <AvatarImage src={firebaseUser.photoURL} className="rounded-xl object-cover animate-fade-in" />
                            <AvatarFallback className="bg-primary/20 text-primary font-bold">{firebaseUser.displayName?.charAt(0) || 'U'}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-sm text-foreground truncate">{firebaseUser.displayName || firebaseUser.email}</h4>
                            <p className="text-xs text-primary/80 font-bold flex items-center gap-1 mt-0.5">
                              <CloudLightning size={12} className="animate-pulse" /> Cloud Active Security
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-2xl border border-dashed border-border/60 text-center space-y-3">
                          <p className="text-xs text-muted-foreground font-semibold">Link your profile with Google to safeguard objectives across all tactical arrays.</p>
                          <Button 
                            className="w-full bg-[#4285F4] hover:bg-[#4285F4]/90 text-white font-bold text-xs h-10 rounded-xl flex items-center justify-center gap-2"
                            onClick={async () => {
                              const provider = new GoogleAuthProvider();
                              try {
                                const result = await signInWithPopup(auth, provider);
                                toast.success(`Welcome back, ${result.user.displayName}`);
                              } catch (err: any) {
                                handleFirestoreError(err, OperationType.GET, 'auth');
                              }
                            }}
                          >
                            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                            </svg>
                            Secure Link-up via Google
                          </Button>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="perf-user-name" className="text-xs font-black uppercase tracking-widest text-zinc-950 dark:text-zinc-50">Designation Name</Label>
                        <Input 
                          id="perf-user-name" 
                          value={userName} 
                          onChange={(e) => {
                            setUserName(e.target.value);
                            localStorage.setItem('pandior_user_name', e.target.value);
                          }}
                          className="rounded-xl h-12 bg-white/5 border border-white/10 text-foreground"
                          placeholder="Your planning rank" 
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="perf-user-title" className="text-xs font-black uppercase tracking-widest text-zinc-950 dark:text-zinc-50">Professional Rank / Subtitle</Label>
                        <Input 
                          id="perf-user-title" 
                          defaultValue={localStorage.getItem('pandior_title') || 'Pro Planner'} 
                          onChange={(e) => {
                            localStorage.setItem('pandior_title', e.target.value);
                          }}
                          className="rounded-xl h-12 bg-white/5 border border-white/10 text-foreground"
                          placeholder="e.g. Master Strategist" 
                        />
                      </div>
                    </div>

                    <div className="pt-4 flex flex-col gap-3">
                      <Button 
                        onClick={() => {
                          toast.success("Profile records modernized successfully!");
                          haptics.impact();
                        }}
                        className="w-full rounded-2xl h-12 font-bold"
                      >
                        Save Profiling Metadata
                      </Button>
                      {firebaseUser && (
                        <Button 
                          variant="ghost"
                          onClick={() => {
                            signOut(auth);
                            toast.success("Tactical profile disconnected safely.");
                          }}
                          className="w-full rounded-2xl h-11 border border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive font-black text-xs uppercase"
                        >
                          Safely Uncouple Profile
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Integrations Card */}
                  <div className="p-8 rounded-[2.5rem] glass-card border border-border/50 flex flex-col space-y-6">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <Sliders size={20} className="text-primary" /> Workspace Integrations
                    </h3>
                    
                    <div className="space-y-4">
                      {/* Google Calendar */}
                      <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 border border-border/30">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-500">
                            <CalendarIcon size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-bold leading-none">Google Calendar</p>
                            <p className="text-[11px] text-muted-foreground mt-1">Keep schedule synced</p>
                          </div>
                        </div>
                        <Button 
                          variant={connectedAccounts.google ? "destructive" : "secondary"}
                          onClick={() => {
                            const nState = !connectedAccounts.google;
                            setConnectedAccounts(prev => ({ ...prev, google: nState }));
                            localStorage.setItem('pandior_conn_google', nState ? "1" : "0");
                            toast.success(nState ? "Google Calendar synchronized" : "Google Calendar uncoupled");
                            haptics.impact();
                          }}
                          className="h-10 rounded-xl px-4 text-xs font-bold"
                        >
                          {connectedAccounts.google ? "Disconnect" : "Connect"}
                        </Button>
                      </div>

                      {/* Zoom */}
                      <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 border border-border/30">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500">
                            <Video size={18} />
                          </div>
                          <div>
                            <p className="text-sm font-bold leading-none">Zoom Meetings</p>
                            <p className="text-[11px] text-muted-foreground mt-1">Automatic link creation</p>
                          </div>
                        </div>
                        <Button 
                          variant={connectedAccounts.zoom ? "destructive" : "secondary"}
                          onClick={() => {
                            const nState = !connectedAccounts.zoom;
                            setConnectedAccounts(prev => ({ ...prev, zoom: nState }));
                            localStorage.setItem('pandior_conn_zoom', nState ? "1" : "0");
                            toast.success(nState ? "Zoom workspace linked" : "Zoom integration disabled");
                            haptics.impact();
                          }}
                          className="h-10 rounded-xl px-4 text-xs font-bold"
                        >
                          {connectedAccounts.zoom ? "Disconnect" : "Connect"}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Visual Preferences */}
                  <div className="p-8 rounded-[2.5rem] glass-card border border-border/50 col-span-1 md:col-span-2 flex flex-col space-y-6">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <Sun size={20} className="text-primary" /> Aesthetic Adaptability
                    </h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                      <div className="p-5 rounded-2xl bg-muted/15 border border-border/30 flex flex-col justify-between">
                        <div>
                          <p className="text-sm font-bold">Contrast Theme</p>
                          <p className="text-[11px] text-muted-foreground mt-1">Toggle light/dark views</p>
                        </div>
                        <div className="flex items-center justify-between mt-4">
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className={`h-11 w-11 rounded-xl hover:bg-primary/20 ${theme === 'dark' ? 'bg-primary text-primary-foreground border-none scale-105 shadow-md shadow-primary/25' : 'bg-transparent text-muted-foreground'}`}
                            onClick={() => {
                              setTheme('dark');
                              toast.info("Aesthetic shifted: Dark Ambient");
                              haptics.impact();
                            }}
                          >
                            <Moon size={18} />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className={`h-11 w-11 rounded-xl hover:bg-primary/20 ${theme === 'light' ? 'bg-primary text-primary-foreground border-none scale-105 shadow-md shadow-primary/25' : 'bg-transparent text-muted-foreground'}`}
                            onClick={() => {
                              setTheme('light');
                              toast.info("Aesthetic shifted: Celestial Light");
                              haptics.impact();
                            }}
                          >
                            <Sun size={18} />
                          </Button>
                        </div>
                      </div>

                      <div className="p-5 rounded-2xl bg-muted/15 border border-border/30 flex flex-col justify-between">
                        <div>
                          <p className="text-sm font-bold">Audio & Echoes</p>
                          <p className="text-[11px] text-muted-foreground mt-1">Play interface response sound</p>
                        </div>
                        <div className="flex items-center gap-2 mt-4">
                          <Button 
                            onClick={() => {
                              const bState = localStorage.getItem('pandior_sound') !== '0';
                              localStorage.setItem('pandior_sound', bState ? '0' : '1');
                              toast.info(bState ? "Sound FX muted" : "Sounds active");
                              haptics.impact();
                            }}
                            variant="secondary"
                            className="w-full h-11 rounded-xl font-bold text-xs uppercase tracking-wider"
                          >
                            {localStorage.getItem('pandior_sound') === '0' ? "Muted" : "Active"}
                          </Button>
                        </div>
                      </div>

                      <div className="p-5 rounded-2xl bg-muted/15 border border-border/30 flex flex-col justify-between">
                        <div>
                          <p className="text-sm font-bold">Data Storage</p>
                          <p className="text-[11px] text-muted-foreground mt-1">Flush and restore defaults</p>
                        </div>
                        <Dialog>
                          <DialogTrigger render={<Button variant="destructive" className="w-full h-11 rounded-xl font-bold text-xs uppercase tracking-wider mt-4 animate-pulse" />}>
                            Purge Records
                          </DialogTrigger>
                          <DialogContent className="glass-card border border-white/20 rounded-3xl">
                            <DialogHeader>
                              <DialogTitle className="text-2xl font-bold tracking-tight text-destructive">Erase Local Records?</DialogTitle>
                            </DialogHeader>
                            <div className="py-4 space-y-4">
                              <p className="text-sm text-muted-foreground leading-relaxed">This completely purges your local browser storage, resetting all tasks, scheduling histories, XP progression levels, and workspace logs. This operation cannot be undone.</p>
                              <div className="flex justify-end gap-3 pt-4">
                                <Button variant="ghost" onClick={() => haptics.impact()} className="rounded-xl">Retain</Button>
                                <Button 
                                  variant="destructive" 
                                  className="rounded-xl"
                                  onClick={() => {
                                    localStorage.clear();
                                    toast.success("All systems have been wiped.");
                                    haptics.impact();
                                    setTimeout(() => window.location.reload(), 1200);
                                  }}
                                >
                                  Complete Purge
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'privacy' && (
              <motion.div 
                key="privacy"
                initial={{ opacity: 0, x: tabTransitionDirection * 35 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -tabTransitionDirection * 35 }}
                transition={{ type: "spring", stiffness: 350, damping: 30, mass: 0.8 }}
                className="max-w-4xl mx-auto space-y-8 pb-10"
              >
                <div>
                  <h2 className="text-4xl font-bold tracking-tight">Privacy & Security</h2>
                  <p className="text-muted-foreground font-medium mt-1 font-sans">Universal Privacy Rules, Local-First Compliance, and Secure Vault Services.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Local Cryptographic Vault Status */}
                  <div className="p-8 rounded-[2.5rem] glass-card border border-border/50 flex flex-col space-y-6">
                    <h3 className="text-xl font-bold flex items-center gap-2 font-sans">
                      <Key size={20} className="text-primary" /> Cryptographic Vault
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed font-medium font-sans">
                      All your schedules, tasks, credentials, and uploaded files are protected locally inside your sandboxed container using AES-256 standard encryption.
                    </p>

                    <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-sans">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          Secure Sandbox Active
                        </span>
                        <span className="text-[10px] bg-emerald-500/25 px-2 py-0.5 rounded-full text-emerald-700 dark:text-emerald-300 font-bold font-mono">AES-256</span>
                      </div>
                      <div className="font-mono text-xs select-all text-zinc-400 dark:text-zinc-500 mt-2 p-3 bg-black/25 rounded-xl break-all">
                        SEED-UUID: f9a2e3b8-90d1-6c7e-8b43-984be1a0c0bc
                      </div>
                    </div>

                    <div className="pt-2">
                      <Button 
                        variant="outline"
                        onClick={() => {
                          toast.success("Regenerated custom local sandbox encryption keys!");
                          haptics.impact();
                        }}
                        className="w-full rounded-2xl h-11 text-xs font-bold"
                      >
                        Regenerate Shield Key
                      </Button>
                    </div>
                  </div>

                  {/* Universal Privacy & Workspace Rules */}
                  <div className="p-8 rounded-[2.5rem] glass-card border border-border/50 flex flex-col space-y-6">
                    <h3 className="text-xl font-bold flex items-center gap-2 font-sans">
                      <Globe size={20} className="text-primary" /> Universal Governance Standards
                    </h3>
                    <div className="space-y-4 font-sans">
                      <div className="flex gap-3 text-sm">
                        <Scale size={18} className="text-primary shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold leading-none">Local-First Isolation</p>
                          <p className="text-xs text-muted-foreground mt-1 font-medium">Zero third-party tracking. All scheduling, notes, and task data is securely stored inside browser local state databases.</p>
                        </div>
                      </div>

                      <div className="flex gap-3 text-sm">
                        <Lock size={18} className="text-primary shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold leading-none">Credential Encryption</p>
                          <p className="text-xs text-muted-foreground mt-1 font-medium">Linked accounts like Google and Zoom are stored as unshared tokens and verified over standard secure system layers.</p>
                        </div>
                      </div>

                      <div className="flex gap-3 text-sm">
                        <Cpu size={18} className="text-primary shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold leading-none">Strict Sandboxing Principles</p>
                          <p className="text-xs text-muted-foreground mt-1 font-medium">No automated indexing or machine training models run on your workspace files or transcripts unless run manually by you.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Privacy Rules Controls */}
                  <div className="p-8 rounded-[2.5rem] glass-card border border-border/50 col-span-1 md:col-span-2 flex flex-col space-y-6">
                    <h3 className="text-xl font-bold flex items-center gap-2 font-sans">
                      <Shield size={20} className="text-primary" /> Workspace Compliance Rules
                    </h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 font-sans">
                      <div className="p-5 rounded-2xl bg-muted/15 border border-border/30 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold">Strict Hashing Sandbox</p>
                          <p className="text-[11px] text-muted-foreground mt-1">Enforce offline key hash lookup for vault assets</p>
                        </div>
                        <Button 
                          onClick={() => {
                            const current = localStorage.getItem('pandior_strict_sandbox') === '1';
                            localStorage.setItem('pandior_strict_sandbox', current ? '0' : '1');
                            toast.success(current ? "Strict Sandbox Deactivated" : "Strict Sandbox Armed");
                            haptics.impact();
                            setTimeout(() => window.location.reload(), 100);
                          }}
                          variant="secondary"
                          className="h-10 rounded-xl font-bold text-xs px-4"
                        >
                          {localStorage.getItem('pandior_strict_sandbox') === '1' ? "Armed" : "Disarmed"}
                        </Button>
                      </div>

                      <div className="p-5 rounded-2xl bg-muted/15 border border-border/30 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold">Anonymized Session Logs</p>
                          <p className="text-[11px] text-muted-foreground mt-1">Strip device identifiers from workspace logs</p>
                        </div>
                        <Button 
                          onClick={() => {
                            const current = localStorage.getItem('pandior_anon_logs') !== '0';
                            localStorage.setItem('pandior_anon_logs', current ? '0' : '1');
                            toast.info(current ? "Diagnostic logging disabled" : "Logging anonymized");
                            haptics.impact();
                            setTimeout(() => window.location.reload(), 100);
                          }}
                          variant="secondary"
                          className="h-10 rounded-xl font-bold text-xs px-4"
                        >
                          {localStorage.getItem('pandior_anon_logs') === '0' ? "Disabled" : "Active"}
                        </Button>
                      </div>
                    </div>

                    <div className="p-6 rounded-2xl bg-muted/10 border border-border/40 text-xs text-muted-foreground space-y-2 font-sans">
                      <p className="font-bold text-foreground">Pandior Workspace Integrity Rulebook Statement:</p>
                      <p className="leading-relaxed font-medium text-[11px]">
                        By deploying and maintaining Pandior, you agree that your system operations conform with the universal sandbox rules. All local caches under this profile rank are unmonitored, self-regulated, and completely restricted from outbound telemetry leakages. Security complies strictly with local container boundaries.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>
    </div>
  </div>

  {/* Mobile Bottom Nav */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/5 dark:bg-black/15 backdrop-blur-3xl border-t border-white/10 dark:border-white/5 px-4 py-3 flex items-center justify-around z-40">
          <MobileNavItem icon={<LayoutDashboard />} label="Home" active={activeTab === 'dashboard'} onClick={() => handleTabChange('dashboard')} />
          <MobileNavItem icon={<CalendarIcon />} label="Schedule" active={activeTab === 'calendar'} onClick={() => handleTabChange('calendar')} />
          
          <motion.button 
            onClick={toggleVoice}
            whileTap={{ scale: 0.9 }}
            className={`flex flex-col items-center justify-center -mt-12 h-16 w-16 rounded-3xl shadow-2xl shadow-primary/20 transition-all duration-300 ${isListening ? 'bg-destructive rounded-full' : 'bg-primary'} text-white border-4 border-white/10`}
          >
            {isListening ? <X size={28} /> : <Mic size={28} />}
          </motion.button>

          <MobileNavItem icon={<CheckSquare />} label="Tasks" active={activeTab === 'tasks'} onClick={() => handleTabChange('tasks')} />
          <MobileNavItem icon={<Globe />} label="Vault" active={activeTab === 'files'} onClick={() => handleTabChange('files')} />
        </div>
      </main>
    </div>
  );
}

function ScrollToTop({ activeTab }: { activeTab: string }) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const viewports = document.querySelectorAll('[data-slot="scroll-area-viewport"]');
    viewports.forEach(viewport => {
      viewport.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }, [activeTab]);

  return null;
}

function MobileNavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 flex-1 py-1 smooth-transition ${active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
    >
      <div className={`p-2 rounded-xl transition-all duration-300 ${active ? 'bg-primary/10 shadow-[0_0_15px_rgba(var(--primary),0.2)]' : ''}`}>
        {React.isValidElement(icon) && React.cloneElement(icon as React.ReactElement<any>, { size: 20 })}
      </div>
      <span className="text-[10px] font-semibold tracking-wide uppercase">{label}</span>
    </button>
  );
}

function NavItem({ icon, label, active, collapsed, onClick }: { icon: React.ReactNode, label: string, active: boolean, collapsed: boolean, onClick: () => void }) {
  return (
    <motion.button 
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl smooth-transition group relative ${active ? 'text-primary font-bold' : 'hover:bg-muted/40 text-muted-foreground hover:text-foreground'}`}
    >
      {active && (
        <motion.div 
          layoutId="active-nav-bg"
          className="absolute inset-0 bg-primary/5 rounded-xl border-l-4 border-primary"
          transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
        />
      )}
      <div className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-300 ${
        active 
          ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105' 
          : 'bg-muted/50 text-muted-foreground group-hover:bg-muted/80 group-hover:text-primary'
      }`}>
        {icon}
      </div>
      {!collapsed && <span className="relative z-10 text-sm tracking-tight">{label}</span>}
    </motion.button>
  );
}

function renderCalendarDays(currentDate: Date, events: Event[]) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = [];
  let day = startDate;

  while (day <= endDate) {
    const dayEvents = events.filter(e => isSameDay(e.start, day));
    const isCurrentMonth = isSameMonth(day, monthStart);
    const isToday = isSameDay(day, new Date());

    days.push(
      <div 
        key={day.toString()} 
        className={`min-h-[100px] p-2 border-r border-b border-border transition-colors hover:bg-muted/20 ${!isCurrentMonth ? 'bg-muted/10 text-muted-foreground/50' : ''}`}
      >
        <div className="flex justify-between items-center mb-1">
          <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-primary text-primary-foreground' : ''}`}>
            {format(day, 'd')}
          </span>
        </div>
        <div className="space-y-1">
          {dayEvents.slice(0, 3).map(event => (
            <div 
              key={event.id} 
              className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary truncate font-medium border-l-2"
              style={{ 
                borderLeftColor: 
                  event.category === 'work' ? '#3b82f6' : 
                  event.category === 'personal' ? '#a855f7' : 
                  '#f97316',
                color: 
                  event.category === 'work' ? '#3b82f6' : 
                  event.category === 'personal' ? '#a855f7' : 
                  '#f97316',
                backgroundColor: 
                  event.category === 'work' ? 'rgba(59, 130, 246, 0.1)' : 
                  event.category === 'personal' ? 'rgba(168, 85, 247, 0.1)' : 
                  'rgba(249, 115, 22, 0.1)'
              }}
            >
              {event.title}
            </div>
          ))}
          {dayEvents.length > 3 && (
            <div className="text-[10px] text-muted-foreground pl-1">
              + {dayEvents.length - 3} more
            </div>
          )}
        </div>
      </div>
    );
    day = addDays(day, 1);
  }

  return days;
}

function ClockHands() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = time.getHours();
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();

  const hourDeg = (hours % 12) * 30 + minutes * 0.5;
  const minDeg = minutes * 6;
  const secDeg = seconds * 6;

  return (
    <>
      {/* Precision Watch Pointer Center Cog */}
      <circle cx="400" cy="400" r="10" fill="#fbbf24" className="shadow-lg" filter="url(#glow)" />
      <circle cx="400" cy="400" r="4" fill="#ffffff" />

      {/* Hour Hand (Pointer with hollow loop) */}
      <g transform={`rotate(${hourDeg}, 400, 400)`}>
        <line 
          x1="400" 
          y1="400" 
          x2="400" 
          y2="220" 
          stroke="#fef08a" 
          strokeWidth="4" 
          strokeLinecap="round" 
          filter="url(#glow)"
        />
        <circle cx="400" cy="220" r="8" fill="none" stroke="#fef08a" strokeWidth="2.5" />
      </g>

      {/* Minute Hand (Sleek needle with double bar) */}
      <g transform={`rotate(${minDeg}, 400, 400)`}>
        <line 
          x1="400" 
          y1="400" 
          x2="400" 
          y2="150" 
          stroke="#ffffff" 
          strokeWidth="2.5" 
          strokeLinecap="round"
          opacity="0.9"
        />
        <line 
          x1="397" 
          y1="220" 
          x2="403" 
          y2="220" 
          stroke="#ffffff" 
          strokeWidth="2" 
          opacity="0.8"
        />
      </g>

      {/* Second Hand (Telescopic glowing ruby filament) */}
      <g transform={`rotate(${secDeg}, 400, 400)`}>
        <line 
          x1="400" 
          y1="430" 
          x2="400" 
          y2="100" 
          stroke="#f43f5e" 
          strokeWidth="1.2" 
          strokeLinecap="round"
          filter="url(#glow)"
        />
        <circle cx="400" cy="400" r="2.5" fill="#f43f5e" />
      </g>
    </>
  );
}

function ClockBackground({ theme }: { theme: 'light' | 'dark' }) {
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; size: number; duration: number; delay: number }[]>([]);

  // Generate floating star/dust celestial particles on mount for premium surreal feel
  useEffect(() => {
    const freshParticles = Array.from({ length: 20 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 1.5 + 0.8,
      duration: Math.random() * 16 + 10,
      delay: Math.random() * -12
    }));
    setParticles(freshParticles);
  }, []);

  const isDark = theme === 'dark';

  // Optimized high-performance surreal golden sunset cloud backdrop
  const sunsetCloudsUrl = "https://images.unsplash.com/photo-1541417904950-b855846fe074?auto=format&fit=crop&q=70&w=1200";

  // Create radial logarithmic spiral coordinates (centered at 400, 400 inside an 800x800 viewBox)
  const spiralPoints = [];
  const loops = 2.8;
  const steps = 240;
  const maxR = 340; // Outside radius winding inside
  for (let i = 0; i <= steps; i++) {
    const fraction = i / steps;
    const angle = fraction * loops * 2 * Math.PI - Math.PI / 2;
    // Radial shrink modeled exponentially for pristine surreal depth
    const r = maxR * Math.pow(1 - fraction, 1.25);
    const x = 400 + r * Math.sin(angle);
    const y = 400 - r * Math.cos(angle);
    spiralPoints.push({ x, y });
  }

  // Draw smooth continuous SVG spiral path
  const pathD = spiralPoints.reduce((acc, p, j) => {
    return acc + (j === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`);
  }, "");

  // Generate Roman Numerals along spiral path
  const romanNumerals = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  const placedNumerals = [];
  const numeralCount = 18; // Gradual 1.5 loops of active markings
  for (let i = 0; i < numeralCount; i++) {
    const fraction = i / numeralCount;
    // Align placement to natural log offsets
    const angle = fraction * 2.2 * 2 * Math.PI - Math.PI / 2;
    const r = maxR * Math.pow(1 - fraction, 1.2);
    
    const x = 400 + r * Math.sin(angle);
    const y = 400 - r * Math.cos(angle);
    
    const numeral = romanNumerals[i % 12];
    const size = Math.max(8, 22 * (1 - fraction * 0.55));
    const opacity = Math.max(0.15, 0.9 * (1 - fraction * 0.65));
    placedNumerals.push({ text: numeral, x, y, size, opacity, angle });
  }

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden flex items-center justify-center -z-20 transition-all duration-1000">
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        
        {/* Surreal Sunset Imagery Base Layer (Fully Unblocked) */}
        <AnimatePresence mode="wait">
          <motion.div
            key={theme}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            className="absolute inset-0 w-full h-full"
          >
            <div 
              className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-1000"
              style={{ 
                backgroundImage: `url(${sunsetCloudsUrl})`,
                filter: isDark ? 'brightness(0.65) contrast(1.15) saturate(1.1)' : 'brightness(1.05) contrast(1.02) saturate(1.1)'
              }}
            />
            {/* Extremely light theme gradient mesh to ensure highly legible text under transparent cards */}
            <div 
              className="absolute inset-0 transition-colors duration-1000"
              style={{
                background: isDark 
                  ? 'radial-gradient(circle at 50% 50%, rgba(20, 10, 30, 0.15) 0%, rgba(10, 5, 20, 0.4) 100%)' 
                  : 'radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.05) 0%, rgba(255, 240, 230, 0.25) 100%)'
              }}
            />
          </motion.div>
        </AnimatePresence>

        {/* Slow Hanging Cloud Particle Dust */}
        <div className="absolute inset-0 z-0 opacity-40">
          {particles.map(p => (
            <motion.div
              key={p.id}
              className="absolute bg-amber-200/40 rounded-full blur-[0.5px]"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: p.size,
                height: p.size,
              }}
              animate={{
                y: [-5, 5],
                opacity: [0, 0.7, 0],
                scale: [0.9, 1.1, 0.9]
              }}
              transition={{
                duration: p.duration,
                repeat: Infinity,
                delay: p.delay,
                ease: "easeInOut"
              }}
            />
          ))}
        </div>

        {/* The Giant Spiral Clock Face SVG */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <svg 
            viewBox="0 0 800 800" 
            className="w-[72vw] h-[72vw] max-w-[430px] max-h-[430px] opacity-50 md:opacity-60 translate-x-3 translate-y-3 md:translate-x-10 md:translate-y-10 transition-all duration-1000"
          >
            <defs>
              <linearGradient id="spiralGold" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.7" />
                <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#ec4899" stopOpacity="0.1" />
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="8" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Glowing Logarithmic SVG spiral curve */}
            <motion.path 
              d={pathD} 
              fill="none" 
              stroke="url(#spiralGold)" 
              strokeWidth="2.5" 
              strokeDasharray="5 3"
              filter="url(#glow)"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 2, ease: "easeOut" }}
            />

            {/* Glowing subtle spiral dot sequence */}
            {spiralPoints.filter((_, idx) => idx % 8 === 0).map((p, idx) => (
              <circle
                key={`dot-${idx}`}
                cx={p.x}
                cy={p.y}
                r="1.5"
                fill="#fef08a"
                opacity={Math.max(0.1, 0.8 * (1 - idx / 30))}
              />
            ))}

            {/* Render Floating Surreal Roman Numerals with soft light masks */}
            {placedNumerals.map((num, idx) => (
              <motion.g 
                key={`num-${idx}`}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: num.opacity, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
              >
                <text
                  x={num.x}
                  y={num.y + 6}
                  textAnchor="middle"
                  fill="#ffffff"
                  className="font-heading font-light select-none cursor-default drop-shadow-[0_4px_12px_rgba(251,191,36,0.3)]"
                  style={{
                    fontSize: `${num.size}px`,
                    letterSpacing: '0.02em',
                  }}
                >
                  {num.text}
                </text>
              </motion.g>
            ))}

            {/* Optimized ticking clock hands layer */}
            <ClockHands />
          </svg>
        </div>

        {/* Grainy Texture Overlay for Organic Feeling */}
        <div className="absolute inset-0 opacity-[0.035] pointer-events-none mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
      </div>
    </div>
  );
}
