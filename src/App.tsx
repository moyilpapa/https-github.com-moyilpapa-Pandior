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
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  FileText,
  Upload,
  Trophy,
  Flame,
  Sparkles,
  Sun,
  Moon,
  Video,
  Trash2,
  Globe,
  Files,
  Clock,
  Check,
  Download
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

export default function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<Event[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isListening, setIsListening] = useState(false);
  const [streak, setStreak] = useState(() => Number(localStorage.getItem('pandior_streak')) || 5);
  const [xp, setXp] = useState(() => Number(localStorage.getItem('pandior_xp')) || 0);
  const [level, setLevel] = useState(() => Number(localStorage.getItem('pandior_level')) || 1);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [connectedAccounts, setConnectedAccounts] = useState<{google: boolean, zoom: boolean}>({
    google: false,
    zoom: false
  });

  // Persistence effects
  useEffect(() => {
    try {
      const savedEvents = localStorage.getItem('pandior_events');
      const savedTasks = localStorage.getItem('pandior_tasks');
      
      if (savedEvents) {
        const parsed = JSON.parse(savedEvents);
        if (Array.isArray(parsed)) {
          setEvents(parsed.map((e: any) => ({
            ...e,
            start: new Date(e.start),
            end: new Date(e.end)
          })));
        }
      } else {
        // Initial mock data if nothing saved
        const today = new Date();
        setEvents([
          {
            id: '1',
            title: 'Team Sync & Strategy',
            start: new Date(today.setHours(10, 0, 0, 0)),
            end: new Date(today.setHours(11, 0, 0, 0)),
            category: 'meeting',
            priority: 'high',
            description: 'Discuss Q2 goals and roadmap.'
          }
        ]);
      }

      if (savedTasks) {
        const parsed = JSON.parse(savedTasks);
        if (Array.isArray(parsed)) {
          setTasks(parsed.map((t: any) => ({
            ...t,
            dueDate: new Date(t.dueDate)
          })));
        }
      } else {
        const today = new Date();
        setTasks([
          { id: '1', title: 'Review project spec', dueDate: addDays(today, 2), completed: false },
          { id: '2', title: 'Update design assets', dueDate: today, completed: true },
        ]);
      }
    } catch (error) {
      console.error("Error loading saved data:", error);
      // Fallback to defaults is already handled by the state initialization or the else blocks
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('pandior_events', JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    localStorage.setItem('pandior_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('pandior_streak', streak.toString());
  }, [streak]);

  useEffect(() => {
    localStorage.setItem('pandior_xp', xp.toString());
    localStorage.setItem('pandior_level', level.toString());
    
    // Level up logic: 100 XP per level
    if (xp >= level * 100) {
      setLevel(prev => prev + 1);
      toast.success(`Level Up! You are now Level ${level + 1}`, {
        icon: '🚀',
        duration: 5000
      });
      haptics.impact();
    }
  }, [xp, level]);

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

  // Theme effect
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  // Initial mock data
  useEffect(() => {
    const today = new Date();
    setEvents([
      {
        id: '1',
        title: 'Team Sync & Strategy',
        start: new Date(today.setHours(10, 0, 0, 0)),
        end: new Date(today.setHours(11, 0, 0, 0)),
        category: 'meeting',
        priority: 'high',
        description: 'Discuss Q2 goals and roadmap.'
      },
      {
        id: '2',
        title: 'Design Review',
        start: new Date(addDays(today, 1).setHours(14, 0, 0, 0)),
        end: new Date(addDays(today, 1).setHours(15, 30, 0, 0)),
        category: 'work',
        priority: 'medium',
      }
    ]);

    setTasks([
      { id: '1', title: 'Review project spec', dueDate: addDays(today, 2), completed: false },
      { id: '2', title: 'Update design assets', dueDate: today, completed: true },
      { id: '3', title: 'Send weekly report', dueDate: addDays(today, 1), completed: false },
    ]);

    setSuggestions([
      { title: 'Focus Time', reason: 'You have a 3-hour gap on Wednesday afternoon.', suggestedTime: 'Wed, 2:00 PM' },
      { title: 'Reschedule Sync', reason: 'Conflict detected with Design Review.', suggestedTime: 'Thu, 10:00 AM' }
    ]);
  }, []);

  // Voice recognition setup
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = async (event: any) => {
        const transcript = event.results[0][0].transcript;
        setIsListening(false);
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
      };

      recognitionRef.current.onerror = (event: any) => {
        setIsListening(false);
        if (event.error === 'not-allowed') {
          toast.error("Microphone access denied. Please enable it in settings.");
        } else if (event.error === 'network') {
          toast.error("Network error during speech recognition.");
        } else {
          toast.error(`Speech recognition error: ${event.error}`);
        }
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
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
        setEvents(prev => [...prev, newEvent]);
        toast.success(result.message || "Event scheduled!");
        notifications.schedule("Pandior: New Event", `Scheduled: ${newEvent.title}`);
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
        setTasks(prev => [...prev, newTask]);
        toast.success(result.message || "Task added!");
        notifications.schedule("Pandior: New Task", `Added: ${newTask.title}`);
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

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (error) {
        console.error("Failed to start speech recognition:", error);
        // Sometimes start() fails if it's already running or in a weird state
        setIsListening(false);
      }
    }
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
      
      {/* Dynamic Clock Background */}
      <ClockBackground theme={theme} />
      
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ 
          width: isSidebarOpen ? 280 : 80,
          x: (window.innerWidth < 768 && !isSidebarOpen) ? -280 : 0
        }}
        transition={{ type: "spring", stiffness: 350, damping: 30 }}
        className={`fixed md:relative h-full border-r border-white/10 dark:border-white/5 bg-white/5 dark:bg-black/15 backdrop-blur-xl flex flex-col z-50`}
      >
        {/* Mobile Overlay */}
        {isSidebarOpen && (
          <div 
            className="md:hidden fixed inset-0 bg-black/10 backdrop-blur-sm z-[-1]" 
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
        
        <div className="p-8 flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/20 rounded-2xl flex items-center justify-center text-primary border border-primary/20">
            <Sparkles size={24} className="animate-pulse" />
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
          <NavItem 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            collapsed={!isSidebarOpen}
            onClick={() => setActiveTab('dashboard')}
          />
          <NavItem 
            icon={<CalendarIcon size={20} />} 
            label="Calendar" 
            active={activeTab === 'calendar'} 
            collapsed={!isSidebarOpen}
            onClick={() => setActiveTab('calendar')}
          />
          <NavItem 
            icon={<CheckSquare size={20} />} 
            label="Tasks" 
            active={activeTab === 'tasks'} 
            collapsed={!isSidebarOpen}
            onClick={() => setActiveTab('tasks')}
          />
          <NavItem 
            icon={<Globe size={20} />} 
            label="File" 
            active={activeTab === 'files'} 
            collapsed={!isSidebarOpen}
            onClick={() => setActiveTab('files')}
          />
          <NavItem 
            icon={<History size={20} />} 
            label="Activity" 
            active={activeTab === 'history'} 
            collapsed={!isSidebarOpen}
            onClick={() => setActiveTab('history')}
          />
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
                    <p className="text-xs font-bold leading-none">Jedi Amos</p>
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
               className="hover:bg-muted/50 rounded-xl"
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
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-muted/40 rounded-2xl border border-border/50">
              <Flame size={16} className="text-rose-500 animate-bounce" />
              <span className="text-sm font-bold tracking-tight">{streak} Daily Streak</span>
            </div>

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
              <Button variant="ghost" size="icon" className="relative rounded-xl hover:bg-muted/50">
                <Bell size={20} />
                <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full ring-4 ring-background"></span>
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setActiveTab('settings')}
                className={`rounded-xl hover:bg-muted/50 ${activeTab === 'settings' ? 'bg-primary/10 text-primary' : ''}`}
              >
                <Settings size={20} />
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
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="bento-grid"
                  >
                    {/* Welcome Card */}
                    <div className="col-span-12 lg:col-span-8 p-10 rounded-3xl glass-card relative overflow-hidden group min-h-[340px] flex flex-col justify-center">
                      <div className="absolute top-0 right-0 p-12 text-primary/5 group-hover:text-primary/10 smooth-transition">
                        <Sparkles size={180} />
                      </div>
                      <div className="relative z-10">
                        <Badge className="bg-primary/20 text-primary border-none mb-6 px-4 py-1.5 text-[10px] uppercase tracking-widest font-black">Authorized Access</Badge>
                        <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Good Morning, Jedi.</h2>
                        <p className="text-lg text-muted-foreground/80 max-w-lg leading-relaxed font-medium">
                          You have {upcomingEvents.length} assignments prioritized for today. 
                          Your current focus efficiency is at 94% — the highest this week.
                        </p>
                        <div className="flex items-center gap-4 mt-10">
                           <Button 
                             className="rounded-2xl h-14 px-10 text-base font-bold shadow-2xl shadow-primary/30"
                             onClick={() => setActiveTab('calendar')}
                           >
                              Review Deployment
                           </Button>
                           <Button 
                             variant="secondary"
                             className="rounded-2xl h-14 px-8 text-base font-bold bg-muted/50 border border-border/50"
                             onClick={toggleVoice}
                           >
                              <Mic className="mr-2" size={18} /> Voice Synthesis
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
                             <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10">
                                <p className="text-[11px] font-medium leading-relaxed italic opacity-80 italic">
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
                          <Button variant="ghost" size="sm" className="rounded-xl text-primary font-bold" onClick={() => setActiveTab('calendar')}>Sync Full Grid</Button>
                       </div>
                       <div className="space-y-1">
                          {upcomingEvents.slice(0, 3).map(event => (
                            <div key={event.id} className="p-5 rounded-2xl hover:bg-muted/30 border border-transparent hover:border-border/50 smooth-transition flex gap-6 group">
                               <div className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center font-bold border transition-all duration-300 ${
                                 event.category === 'work' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                 event.category === 'personal' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' :
                                 'bg-orange-500/10 text-orange-500 border-orange-500/20'
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
                          <Button variant="ghost" size="sm" className="rounded-xl text-primary font-bold" onClick={() => setActiveTab('tasks')}>Queue</Button>
                       </div>
                       <div className="space-y-4">
                          {tasks.slice(0, 4).map(task => (
                            <div 
                              key={task.id} 
                              className="flex items-center gap-5 p-4 rounded-2xl bg-muted/20 hover:bg-muted/40 border border-border/50 smooth-transition group cursor-pointer"
                              onClick={() => {
                                setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t));
                                if (!task.completed) {
                                  addXp(20);
                                  toast.success("+20 XP Synchronized");
                                }
                              }}
                            >
                               <div className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all duration-300 ${
                                 task.completed ? 'bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20' : 'border-muted-foreground/30 group-hover:border-primary'
                               }`}>
                                  {task.completed && <Check size={18} strokeWidth={4} />}
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
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="h-full flex flex-col space-y-8"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h2 className="text-4xl font-bold tracking-tight">{format(currentDate, 'MMMM yyyy')}</h2>
                    <p className="text-muted-foreground font-medium mt-1">Showing {events.length} active deployments for this sector.</p>
                  </div>
                  <div className="flex items-center gap-3 bg-muted/30 p-2 rounded-2xl border border-border/50">
                    <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 hover:bg-background shadow-sm" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
                      <ChevronLeft size={18} />
                    </Button>
                    <Button variant="ghost" className="rounded-xl px-6 h-10 hover:bg-background shadow-sm font-bold text-xs uppercase tracking-widest" onClick={() => setCurrentDate(new Date())}>Current Epoch</Button>
                    <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 hover:bg-background shadow-sm" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
                      <ChevronRight size={18} />
                    </Button>
                  </div>
                </div>

                <div className="flex-1 glass-card rounded-[2.5rem] border border-border/50 flex flex-col overflow-hidden shadow-2xl">
                  <div className="grid grid-cols-7 border-b border-border/30 bg-muted/20">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} className="py-5 text-center text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 grid grid-cols-7 grid-rows-6">
                    {renderCalendarDays(currentDate, events)}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'tasks' && (
              <motion.div 
                key="tasks"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
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
                          <Label htmlFor="task-title" className="text-xs font-black uppercase tracking-widest opacity-60">Objective Designation</Label>
                          <Input id="task-title" placeholder="Define your next target..." className="rounded-xl h-12 bg-muted/30" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="task-date" className="text-xs font-black uppercase tracking-widest opacity-60">Target Timeline</Label>
                          <Input id="task-date" type="date" className="rounded-xl h-12 bg-muted/30" />
                        </div>
                        <Button className="w-full h-14 rounded-2xl font-bold text-lg" onClick={() => {
                          const title = (document.getElementById('task-title') as HTMLInputElement).value;
                          const date = (document.getElementById('task-date') as HTMLInputElement).value;
                          if (title && date) {
                            setTasks(prev => [...prev, {
                              id: Math.random().toString(36).substr(2, 9),
                              title,
                              dueDate: new Date(date),
                              completed: false
                            }]);
                            toast.success("Objective Synchronized");
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
                        className={`w-10 h-10 rounded-2xl border-2 flex items-center justify-center cursor-pointer transition-all duration-300 ${task.completed ? 'bg-primary border-primary text-primary-foreground shadow-lg' : 'border-muted-foreground/30 hover:border-primary group-hover:scale-110'}`}
                        onClick={() => {
                          setTasks(prev => prev.map(t => {
                            if (t.id === task.id) {
                              const newCompleted = !t.completed;
                              if (newCompleted) {
                                addXp(20);
                                toast.success("+20 XP Synchronized");
                              }
                              return { ...t, completed: newCompleted };
                            }
                            return t;
                          }));
                        }}
                      >
                        {task.completed && <Check size={20} strokeWidth={4} />}
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
                                setTasks(prev => prev.filter(t => t.id !== task.id));
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
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
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
                    { name: 'sector_alpha.pdf', size: '2.4 MB', type: 'PDF', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
                    { name: 'tactical_core.zip', size: '15.8 MB', type: 'ARCHIVE', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
                    { name: 'intel_report.docx', size: '45 KB', type: 'DOC', color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' },
                    { name: 'encrypted_comms.pdf', size: '1.2 MB', type: 'PDF', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
                    { name: 'manifest_v3.json', size: '12 KB', type: 'DATA', color: 'bg-green-500/10 text-green-500 border-green-500/20' }
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
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
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
                                      event.category === 'work' ? 'bg-blue-500/10 text-blue-500' :
                                      event.category === 'personal' ? 'bg-purple-500/10 text-purple-500' :
                                      'bg-orange-500/10 text-orange-500'
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
          </AnimatePresence>
        </div>
      </ScrollArea>
    </div>
  </div>

  {/* Mobile Bottom Nav */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/5 dark:bg-black/15 backdrop-blur-3xl border-t border-white/10 dark:border-white/5 px-4 py-3 flex items-center justify-around z-40">
          <MobileNavItem icon={<LayoutDashboard />} label="Home" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <MobileNavItem icon={<CalendarIcon />} label="Schedule" active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} />
          
          <motion.button 
            onClick={toggleVoice}
            whileTap={{ scale: 0.9 }}
            className={`flex flex-col items-center justify-center -mt-12 h-16 w-16 rounded-3xl shadow-2xl shadow-primary/20 transition-all duration-300 ${isListening ? 'bg-destructive rounded-full' : 'bg-primary'} text-white border-4 border-white/10`}
          >
            {isListening ? <X size={28} /> : <Mic size={28} />}
          </motion.button>

          <MobileNavItem icon={<CheckSquare />} label="Tasks" active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')} />
          <MobileNavItem icon={<Globe />} label="Vault" active={activeTab === 'files'} onClick={() => setActiveTab('files')} />
        </div>
      </main>
    </div>
  );
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

function ClockBackground({ theme }: { theme: 'light' | 'dark' }) {
  const [time, setTime] = useState(new Date());
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; size: number; duration: number; delay: number }[]>([]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Generate floating star/dust celestial particles on mount for premium surreal feel
  useEffect(() => {
    const freshParticles = Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 1,
      duration: Math.random() * 12 + 8,
      delay: Math.random() * -10
    }));
    setParticles(freshParticles);
  }, []);

  const hours = time.getHours();
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();

  const hourDeg = (hours % 12) * 30 + minutes * 0.5;
  const minDeg = minutes * 6;
  const secDeg = seconds * 6;

  const isDark = theme === 'dark';

  // Premium, breathtaking surreal golden sunset cloud landscape perfectly matching the user's uploaded backdrop
  const sunsetCloudsUrl = "https://images.unsplash.com/photo-1541417904950-b855846fe074?auto=format&fit=crop&q=80&w=2400";

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
                y: [-25, 25],
                opacity: [0, 0.8, 0],
                scale: [0.8, 1.2, 0.8]
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
            className="w-[95vw] h-[95vw] max-w-[850px] max-h-[850px] opacity-75 md:opacity-85 translate-x-4 md:translate-x-16 transition-transform duration-1000"
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
          </svg>
        </div>

        {/* Grainy Texture Overlay for Organic Feeling */}
        <div className="absolute inset-0 opacity-[0.035] pointer-events-none mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
      </div>
    </div>
  );
}
