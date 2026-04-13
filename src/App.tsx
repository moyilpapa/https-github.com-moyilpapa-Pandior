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
  Trash2
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
    <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden">
      <Toaster position="top-right" />
      
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ 
          width: isSidebarOpen ? 260 : 80,
          x: (window.innerWidth < 768 && !isSidebarOpen) ? -260 : 0
        }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className={`fixed md:relative h-full border-r border-border bg-card flex flex-col z-50`}
      >
        {/* Mobile Overlay */}
        {isSidebarOpen && (
          <div 
            className="md:hidden fixed inset-0 bg-black/50 z-[-1]" 
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground shadow-[0_0_15px_rgba(var(--primary),0.4)]">
            <Sparkles size={20} />
          </div>
          {isSidebarOpen && <h1 className="font-branding text-3xl tracking-wider text-primary drop-shadow-sm">Pandior</h1>}
        </div>

        <nav className="flex-1 px-3 space-y-1">
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
            icon={<History size={20} />} 
            label="History" 
            active={activeTab === 'history'} 
            collapsed={!isSidebarOpen}
            onClick={() => setActiveTab('history')}
          />
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src="https://github.com/shadcn.png" />
              <AvatarFallback>JD</AvatarFallback>
            </Avatar>
            {isSidebarOpen && (
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium truncate">Jedi Amos</p>
                <p className="text-xs text-muted-foreground truncate">jediamos2@gmail.com</p>
              </div>
            )}
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        {/* Header */}
        <header className="h-16 border-bottom border-border flex items-center justify-between px-4 md:px-6 bg-background/80 backdrop-blur-md sticky top-0 z-50">
          <div className="flex items-center gap-2 md:gap-4 flex-1">
            <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:flex">
              <Menu size={20} />
            </Button>
            
            <div className="flex-1 flex items-center gap-2">
              <div className={`relative max-w-md w-full ${isMobileSearchOpen ? 'flex' : 'hidden md:block'}`}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input 
                  placeholder="Search..." 
                  className="pl-10 bg-muted/50 border-none focus-visible:ring-1 w-full"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && searchQuery.trim()) {
                      if (searchQuery.toLowerCase().includes('?') || searchQuery.toLowerCase().startsWith('how') || searchQuery.toLowerCase().startsWith('what')) {
                        toast.loading("Asking Pandior AI...");
                        try {
                          const result = await parseNaturalLanguageInput(searchQuery, new Date().toISOString());
                          handleAIResult(result);
                          setSearchQuery('');
                          setIsMobileSearchOpen(false);
                        } catch (error) {
                          toast.error("AI Assistant is currently busy.");
                        }
                      }
                    }
                  }}
                />
                {isMobileSearchOpen && (
                  <Button variant="ghost" size="icon" className="md:hidden ml-1" onClick={() => setIsMobileSearchOpen(false)}>
                    <X size={18} />
                  </Button>
                )}
              </div>
              
              {!isMobileSearchOpen && (
                <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsMobileSearchOpen(true)}>
                  <Search size={20} />
                </Button>
              )}
            </div>
          </div>
          
          <div className={`flex items-center gap-2 md:gap-3 ${isMobileSearchOpen ? 'hidden sm:flex' : 'flex'}`}>
            <div className="hidden lg:flex flex-col items-end mr-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{format(new Date(), 'EEEE')}</span>
              <span className="text-sm font-bold">{format(new Date(), 'MMMM d, yyyy')}</span>
            </div>
            <div className="flex items-center gap-1 px-3 py-1 bg-primary/10 rounded-full text-primary font-medium text-sm">
              <Flame size={16} className="fill-primary" />
              <span>{streak} Day Streak</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-secondary rounded-full text-secondary-foreground font-medium text-sm">
              <Trophy size={16} className="text-yellow-500" />
              <span>Level {level}</span>
              <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden ml-1">
                <div 
                  className="h-full bg-primary transition-all duration-500" 
                  style={{ width: `${(xp % 100)}%` }}
                />
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
              className="relative"
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
            <Button variant="ghost" size="icon" className="relative">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full border-2 border-background"></span>
            </Button>
            <Button variant="ghost" size="icon">
              <Settings size={20} />
            </Button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden p-4 md:p-6 relative pb-24 md:pb-6">
          <div className="max-w-6xl mx-auto h-full relative">
            <div className="lightning-border rounded-3xl h-full p-1.5 shadow-2xl overflow-hidden">
              <div className="lightning-effect" />
              <div className="bg-background h-full rounded-[20px] overflow-hidden">
                <ScrollArea className="h-full w-full">
                  <div className="p-4 md:p-10 md:px-12">
                    <AnimatePresence mode="wait">
                {activeTab === 'dashboard' && (
                  <motion.div 
                    key="dashboard"
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    variants={{
                      hidden: { opacity: 0, y: 30 },
                      visible: { 
                        opacity: 1, 
                        y: 0,
                        transition: {
                          staggerChildren: 0.1,
                          type: "spring",
                          damping: 25,
                          stiffness: 120
                        }
                      },
                      exit: { opacity: 0, y: -30 }
                    }}
                    className="space-y-12 max-w-6xl mx-auto"
                  >
                    <motion.div 
                      variants={{
                        hidden: { opacity: 0, y: 20 },
                        visible: { opacity: 1, y: 0 }
                      }}
                      className="grid grid-cols-1 md:grid-cols-3 gap-8"
                    >
                      <Card className="md:col-span-2 border-none shadow-2xl bg-gradient-to-br from-primary/20 via-card/80 to-card/50 backdrop-blur-xl relative group border border-white/10 three-d-card overflow-hidden">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(var(--primary),0.15),transparent)] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                        <CardHeader className="three-d-inner pt-12 pb-6 px-8 md:px-16">
                          <CardTitle className="flex items-center gap-5 text-3xl md:text-4xl font-heading font-bold tracking-tight text-foreground">
                            Welcome to Pandior <Sparkles className="text-primary animate-pulse" size={32} />
                          </CardTitle>
                          <CardDescription className="text-lg md:text-xl text-muted-foreground/90 font-medium mt-3">
                            You have {upcomingEvents.length} events scheduled for today.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="three-d-inner px-8 md:px-16 pb-12">
                      <div className="flex items-center gap-8">
                        <div className="flex-1">
                          <p className="text-base text-muted-foreground mb-6 italic leading-relaxed">
                            "The best way to predict the future is to schedule it. You're on a {streak} day streak!"
                          </p>
                          <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <Button 
                              className="rounded-full px-10 py-6 text-lg font-bold shadow-2xl shadow-primary/30 smooth-transition bg-primary text-primary-foreground border-b-4 border-primary/50"
                              onClick={() => setActiveTab('calendar')}
                            >
                              View Schedule
                            </Button>
                          </motion.div>
                        </div>
                        <div className="hidden sm:block">
                          <motion.div
                            animate={{ rotate: [0, 10, -10, 0], y: [0, -10, 0] }}
                            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                          >
                            <Trophy size={100} className="text-primary/20 drop-shadow-[0_0_20px_rgba(var(--primary),0.3)]" />
                          </motion.div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-none shadow-xl glass-card three-d-card">
                    <CardHeader className="three-d-inner">
                      <CardTitle className="text-xs font-bold uppercase tracking-[0.2em] text-primary/80">System Stats</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-2">
                        <div className="flex justify-between items-end">
                          <span className="text-xs font-medium text-muted-foreground">Task Completion</span>
                          <span className="text-lg font-mono font-bold text-primary">80%</span>
                        </div>
                        <div className="w-full bg-muted/30 rounded-full h-1.5 overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: '80%' }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className="bg-primary h-full rounded-full shadow-[0_0_10px_var(--primary)]" 
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-end">
                          <span className="text-xs font-medium text-muted-foreground">Efficiency</span>
                          <span className="text-lg font-mono font-bold text-primary">+12%</span>
                        </div>
                        <div className="w-full bg-muted/30 rounded-full h-1.5 overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: '92%' }}
                            transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                            className="bg-primary h-full rounded-full shadow-[0_0_10px_var(--primary)]" 
                          />
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full text-[10px] h-8 border-primary/20 hover:bg-primary/5 three-d-card"
                        onClick={() => {
                          haptics.impact();
                          toast.success("System Pulse Synchronized");
                        }}
                      >
                        <span className="three-d-inner">Sync System Pulse</span>
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>

                    <motion.div 
                      variants={{
                        hidden: { opacity: 0, y: 20 },
                        visible: { opacity: 1, y: 0 }
                      }}
                      className="grid grid-cols-1 lg:grid-cols-3 gap-8"
                    >
                      <Card className="lg:col-span-2 border-none shadow-xl glass-card three-d-card">
                        <CardHeader className="flex flex-row items-center justify-between three-d-inner">
                          <CardTitle className="text-xl font-heading font-bold">Upcoming Events</CardTitle>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="bg-primary/10 text-primary border-none">
                              {upcomingEvents.length} Scheduled
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <AnimatePresence initial={false} mode="popLayout">
                              {upcomingEvents.length > 0 ? (
                                upcomingEvents.map((event) => (
                                  <motion.div
                                    key={event.id}
                                    layout
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ type: "spring", duration: 0.5 }}
                                    className={`flex items-center justify-between p-4 rounded-2xl bg-muted/30 hover:bg-muted/50 smooth-transition border-l-4 group relative overflow-hidden hover:scale-[1.01] hover:shadow-lg active:scale-[0.98] lightning-border-sm ${
                                      event.category === 'work' ? 'lightning-border-work' : 
                                      event.category === 'personal' ? 'lightning-border-personal' : 
                                      'lightning-border-other'
                                    }`}
                                  >
                                    <div className="flex items-center gap-4 relative z-10">
                                      <div className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center shadow-lg ${
                                        event.category === 'work' ? 'bg-blue-500/20 text-blue-500 shadow-blue-500/10' :
                                        event.category === 'personal' ? 'bg-purple-500/20 text-purple-500 shadow-purple-500/10' :
                                        'bg-orange-500/20 text-orange-500 shadow-orange-500/10'
                                      }`}>
                                        <span className="text-[10px] font-bold uppercase leading-none">{format(event.start, 'MMM')}</span>
                                        <span className="text-lg font-bold leading-none">{format(event.start, 'dd')}</span>
                                      </div>
                                      <div>
                                        <h4 className="font-bold text-foreground group-hover:text-primary transition-colors truncate max-w-[200px] sm:max-w-xs">{event.title}</h4>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                          <span>{format(event.start, 'h:mm a')}</span>
                                          <span>•</span>
                                          <Badge variant="outline" className="h-4 text-[10px] px-1 capitalize border-muted-foreground/20">{event.category}</Badge>
                                          {connectedAccounts.google && (
                                            <span className="text-primary flex items-center gap-1 ml-1">
                                              <Video size={12} /> Meet
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 relative z-10">
                                      {connectedAccounts.google && (
                                        <Button 
                                          variant="outline" 
                                          size="sm" 
                                          className="rounded-full h-8 text-[10px] border-primary/20 hover:bg-primary/10 hidden sm:flex"
                                          onClick={() => toast.info("Joining Google Meet...")}
                                        >
                                          Join
                                        </Button>
                                      )}
                                      <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ChevronRight size={18} />
                                      </Button>
                                    </div>
                                  </motion.div>
                                ))
                              ) : (
                                <motion.div 
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  className="py-12 text-center"
                                >
                                  <div className="w-16 h-16 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <CalendarIcon className="text-muted-foreground/50" size={32} />
                                  </div>
                                  <p className="text-muted-foreground">No upcoming events scheduled.</p>
                                  <Button variant="link" className="text-primary mt-2" onClick={() => setActiveTab('calendar')}>
                                    Schedule something new
                                  </Button>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </CardContent>
                      </Card>

                      <motion.div 
                        variants={{
                          hidden: { opacity: 0, y: 20 },
                          visible: { opacity: 1, y: 0 }
                        }}
                        className="space-y-6"
                      >
                        <Card className="border-none shadow-xl glass-card three-d-card">
                      <CardHeader className="three-d-inner">
                        <CardTitle className="text-xs font-bold uppercase tracking-[0.2em] text-primary/80">Integrations</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-3 rounded-2xl bg-primary/5 border border-primary/10 group hover:bg-primary/10 smooth-transition">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-md">
                              <img src="https://www.gstatic.com/images/branding/product/2x/meet_2020q4_48dp.png" alt="Google Meet" className="w-6 h-6" referrerPolicy="no-referrer" />
                            </div>
                            <div>
                              <span className="text-sm font-bold block">Google Meet</span>
                              <span className="text-[10px] text-muted-foreground">{connectedAccounts.google ? 'Connected' : 'Not connected'}</span>
                            </div>
                          </div>
                          <Button 
                            variant={connectedAccounts.google ? "ghost" : "default"} 
                            size="sm" 
                            className="h-8 rounded-full text-[10px]"
                            onClick={() => setConnectedAccounts(prev => ({...prev, google: !prev.google}))}
                          >
                            {connectedAccounts.google ? 'Disconnect' : 'Connect'}
                          </Button>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-2xl bg-primary/5 border border-primary/10 group hover:bg-primary/10 smooth-transition">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#2D8CFF] flex items-center justify-center shadow-md">
                              <Video className="text-white" size={20} />
                            </div>
                            <div>
                              <span className="text-sm font-bold block">Zoom</span>
                              <span className="text-[10px] text-muted-foreground">{connectedAccounts.zoom ? 'Connected' : 'Not connected'}</span>
                            </div>
                          </div>
                          <Button 
                            variant={connectedAccounts.zoom ? "ghost" : "default"} 
                            size="sm" 
                            className="h-8 rounded-full text-[10px]"
                            onClick={() => setConnectedAccounts(prev => ({...prev, zoom: !prev.zoom}))}
                          >
                            {connectedAccounts.zoom ? 'Disconnect' : 'Connect'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm border border-white/5">
                      <CardHeader>
                        <CardTitle className="text-xs font-bold uppercase tracking-[0.2em] text-primary/80">Native Bridge Status</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-2 rounded-lg bg-primary/5 border border-primary/10">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${isNative ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
                            <span className="text-xs font-medium">Capacitor Runtime</span>
                          </div>
                          <Badge variant="outline" className="text-[10px]">{isNative ? 'Active' : 'Web Preview'}</Badge>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-primary/5 border border-primary/10">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-xs font-medium">Haptic Engine</span>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 text-[10px] px-2"
                            onClick={() => {
                              haptics.impact();
                              toast.info("Haptic feedback triggered");
                            }}
                          >
                            Test
                          </Button>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                          Pandior is optimized for Android and Desktop. Native features are simulated in web preview.
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="border-none shadow-xl glass-card three-d-card">
                      <CardHeader className="three-d-inner">
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                          <Sparkles size={16} className="text-primary" /> Smart Suggestions
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {suggestions.map((s, i) => (
                          <div key={i} className="p-3 rounded-xl bg-background border border-border space-y-2">
                            <div className="flex justify-between items-start">
                              <h5 className="text-sm font-bold">{s.title}</h5>
                              <Badge variant="secondary" className="text-[10px]">{s.suggestedTime}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">{s.reason}</p>
                            <Button variant="link" className="p-0 h-auto text-xs text-primary font-bold">Apply Suggestion</Button>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card className="border-none shadow-xl glass-card three-d-card">
                      <CardHeader className="flex flex-row items-center justify-between three-d-inner">
                        <CardTitle className="text-sm font-bold">Recent Tasks</CardTitle>
                        <Button variant="ghost" size="sm" className="h-auto p-0 text-xs">View All</Button>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {tasks.slice(0, 3).map(task => (
                            <div key={task.id} className="flex items-center gap-3 p-2 rounded-lg border-l-4 smooth-transition hover:bg-muted/30 hover:scale-[1.01] hover:shadow-md active:scale-[0.98]"
                              style={{ borderLeftColor: task.completed ? '#22c55e' : 'hsl(var(--primary))' }}
                            >
                              <div 
                                className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${task.completed ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground'}`}
                                onClick={() => {
                                  setTasks(prev => prev.map(t => {
                                    if (t.id === task.id) {
                                      const newCompleted = !t.completed;
                                      if (newCompleted) {
                                        addXp(20);
                                        toast.success("+20 XP", { icon: '✨' });
                                      }
                                      return { ...t, completed: newCompleted };
                                    }
                                    return t;
                                  }));
                                }}
                              >
                                {task.completed && <CheckSquare size={12} />}
                              </div>
                              <span className={`flex-1 text-xs truncate ${task.completed ? 'line-through text-muted-foreground' : ''}`}>{task.title}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </motion.div>
              </motion.div>
            )}

            {activeTab === 'calendar' && (
              <motion.div 
                key="calendar"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="h-full flex flex-col space-y-6 md:px-4"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-3xl font-heading font-bold md:ml-2">{format(currentDate, 'MMMM yyyy')}</h2>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
                      <ChevronLeft size={20} />
                    </Button>
                    <Button variant="outline" onClick={() => setCurrentDate(new Date())}>Today</Button>
                    <Button variant="outline" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
                      <ChevronRight size={20} />
                    </Button>
                  </div>
                </div>
                <div className="flex-1 glass-card rounded-2xl border border-border flex flex-col shadow-2xl three-d-card">
                  <div className="grid grid-cols-7 border-b border-border bg-muted/30 three-d-inner">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} className="py-3 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">
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
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-4xl mx-auto space-y-8 md:px-4"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-3xl font-heading font-bold md:ml-2">Tasks & Files</h2>
                  <Dialog>
                    <DialogTrigger render={<Button className="rounded-full gap-2 three-d-card"><Plus size={18} className="three-d-inner" /> <span className="three-d-inner">Add Task</span></Button>} />
                    <DialogContent className="glass-card">
                      <DialogHeader>
                        <DialogTitle>Create New Task</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="task-title">Task Title</Label>
                          <Input id="task-title" placeholder="e.g., Review contract" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="task-date">Due Date</Label>
                          <Input id="task-date" type="date" />
                        </div>
                        <Button className="w-full" onClick={() => {
                          const title = (document.getElementById('task-title') as HTMLInputElement).value;
                          const date = (document.getElementById('task-date') as HTMLInputElement).value;
                          if (title && date) {
                            setTasks(prev => [...prev, {
                              id: Math.random().toString(36).substr(2, 9),
                              title,
                              dueDate: new Date(date),
                              completed: false
                            }]);
                            toast.success("Task created!");
                          }
                        }}>Create Task</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 space-y-4">
                    {tasks.map(task => (
                      <Card key={task.id} className={`border-none shadow-xl group three-d-card lightning-border-sm ${task.completed ? 'opacity-80' : ''}`}>
                        <div className="relative z-10">
                          <div className={`h-1 w-full ${task.completed ? 'bg-green-500' : 'bg-primary'}`} />
                          <CardContent className="p-4 flex items-center gap-4 three-d-inner">
                            <div 
                              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all ${task.completed ? 'bg-green-500 border-green-500 text-white' : 'border-muted-foreground hover:border-primary'}`}
                              onClick={() => {
                                setTasks(prev => prev.map(t => {
                                  if (t.id === task.id) {
                                    const newCompleted = !t.completed;
                                    if (newCompleted) {
                                      addXp(20);
                                      toast.success("+20 XP", { icon: '✨' });
                                    }
                                    return { ...t, completed: newCompleted };
                                  }
                                  return t;
                                }));
                              }}
                            >
                              {task.completed && <CheckSquare size={14} />}
                            </div>
                            <div className="flex-1">
                              <h4 className={`font-bold ${task.completed ? 'line-through text-muted-foreground' : ''}`}>{task.title}</h4>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <CalendarIcon size={12} /> {format(task.dueDate, 'MMM d, yyyy')}
                                </span>
                                {task.assignedFileId && (
                                  <Badge variant="secondary" className="text-[10px] gap-1">
                                    <FileText size={10} /> File Attached
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <AlertDialog>
                              <AlertDialogTrigger render={
                                <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10">
                                  <Trash2 size={18} />
                                </Button>
                              } />
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete the task "{task.title}". This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => {
                                      setTasks(prev => prev.filter(t => t.id !== task.id));
                                      toast.success("Task deleted");
                                      haptics.impact();
                                    }}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </CardContent>
                        </div>
                      </Card>
                    ))}
                    {tasks.length === 0 && (
                      <div className="text-center py-12 bg-muted/20 rounded-2xl border-2 border-dashed border-border">
                        <CheckSquare size={48} className="mx-auto mb-4 text-muted-foreground opacity-20" />
                        <p className="text-muted-foreground">No tasks yet. Create one or use voice command!</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-6">
                    <Card className="border-none shadow-xl glass-card three-d-card">
                      <CardHeader className="three-d-inner">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider">File Vault</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4 three-d-inner">
                        <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:bg-muted/50 smooth-transition cursor-pointer group hover:scale-[1.02] hover:shadow-lg">
                          <Upload size={32} className="mx-auto mb-2 text-muted-foreground group-hover:text-primary transition-colors" />
                          <p className="text-xs font-bold">Click to upload or drag & drop</p>
                          <p className="text-[10px] text-muted-foreground mt-1">PDF, DOCX, Images up to 10MB</p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 smooth-transition cursor-pointer hover:translate-x-1">
                            <div className="w-8 h-8 rounded bg-red-100 text-red-600 flex items-center justify-center shadow-md">
                              <FileText size={16} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold truncate">project_spec.pdf</p>
                              <p className="text-[10px] text-muted-foreground">2.4 MB</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 smooth-transition cursor-pointer hover:translate-x-1">
                            <div className="w-8 h-8 rounded bg-blue-100 text-blue-600 flex items-center justify-center shadow-md">
                              <FileText size={16} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold truncate">design_assets.zip</p>
                              <p className="text-[10px] text-muted-foreground">15.8 MB</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-none shadow-xl bg-primary text-primary-foreground three-d-card">
                      <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <CardHeader className="three-d-inner">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider opacity-80">AI Tip</CardTitle>
                      </CardHeader>
                      <CardContent className="three-d-inner">
                        <p className="text-xs leading-relaxed font-medium">
                          Try saying: "Assign a task to review project_spec.pdf by Friday." Pandior will automatically link the file!
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'history' && (
              <motion.div 
                key="history"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-4xl mx-auto space-y-8 md:px-4"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-3xl font-heading font-bold md:ml-2">Event History</h2>
                  <Badge variant="outline" className="rounded-full">{pastEvents.length} Past Events</Badge>
                </div>
                
                <div className="space-y-4">
                    {pastEvents.length > 0 ? (
                      pastEvents.map(event => (
                        <Card key={event.id} className={`border-none shadow-xl group bg-muted/20 three-d-card lightning-border-sm ${
                          event.category === 'work' ? 'lightning-border-work' : 
                          event.category === 'personal' ? 'lightning-border-personal' : 
                          'lightning-border-other'
                        }`}>
                          <CardContent className="p-4 flex items-center gap-4 three-d-inner relative z-10">
                            <div className={`w-12 h-12 rounded-2xl bg-muted flex flex-col items-center justify-center text-muted-foreground shrink-0 shadow-inner ${
                              event.category === 'work' ? 'text-blue-500/50' :
                              event.category === 'personal' ? 'text-purple-500/50' :
                              'text-orange-500/50'
                            }`}>
                              <span className="text-[10px] font-bold uppercase leading-none">{format(event.start, 'MMM')}</span>
                              <span className="text-lg font-bold leading-none">{format(event.start, 'dd')}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-muted-foreground truncate">{event.title}</h4>
                              <p className="text-xs text-muted-foreground/60">{format(event.start, 'MMM d, yyyy')} • {format(event.start, 'h:mm a')}</p>
                            </div>
                            <Badge variant="secondary" className="opacity-50 capitalize">{event.category}</Badge>
                          </CardContent>
                        </Card>
                      ))
                    ) : (
                    <div className="text-center py-12 bg-muted/10 rounded-2xl border-2 border-dashed border-border">
                      <History size={48} className="mx-auto mb-4 text-muted-foreground opacity-20" />
                      <p className="text-muted-foreground">No past events yet. Your history will appear here.</p>
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
          </div>
        </div>

        {/* Voice Input FAB */}
        <div className="fixed bottom-24 md:bottom-8 right-8 flex flex-col items-end gap-4 z-30">
          <AnimatePresence>
            {isListening && (
              <motion.div 
                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.8 }}
                className="bg-card border border-border p-4 rounded-2xl shadow-xl mb-2 flex items-center gap-3"
              >
                <div className="flex gap-1">
                  {[1, 2, 3].map(i => (
                    <motion.div 
                      key={i}
                      animate={{ height: [8, 16, 8] }}
                      transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                      className="w-1 bg-primary rounded-full"
                    />
                  ))}
                </div>
                <p className="text-sm font-medium">Listening...</p>
              </motion.div>
            )}
          </AnimatePresence>
          
          <Button 
            size="lg" 
            className={`h-16 w-16 rounded-full shadow-2xl transition-all duration-300 three-d-card ${isListening ? 'bg-destructive hover:bg-destructive/90 scale-110' : 'bg-primary hover:bg-primary/90'}`}
            onClick={toggleVoice}
          >
            <div className="three-d-inner">
              {isListening ? <X size={28} /> : <Mic size={28} />}
            </div>
          </Button>
        </div>

        {/* Mobile Bottom Nav */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-lg border-t border-border px-6 py-3 flex items-center justify-between z-40">
          <MobileNavItem icon={<LayoutDashboard size={20} />} label="Home" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <MobileNavItem icon={<CalendarIcon size={20} />} label="Calendar" active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} />
          <div className="w-12" /> {/* Spacer for FAB */}
          <MobileNavItem icon={<CheckSquare size={20} />} label="Tasks" active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')} />
          <MobileNavItem icon={<History size={20} />} label="History" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
          <MobileNavItem icon={<Settings size={20} />} label="Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </div>
      </main>
    </div>
  );
}

function MobileNavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <motion.button 
      onClick={onClick}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      className={`flex flex-col items-center gap-1 smooth-transition ${active ? 'text-primary' : 'text-muted-foreground'}`}
    >
      <div className={`p-1 rounded-lg transition-colors duration-150 ${active ? 'bg-primary/10' : ''}`}>
        {icon}
      </div>
      <span className="text-[10px] font-medium">{label}</span>
    </motion.button>
  );
}

function NavItem({ icon, label, active, collapsed, onClick }: { icon: React.ReactNode, label: string, active: boolean, collapsed: boolean, onClick: () => void }) {
  return (
    <motion.button 
      onClick={onClick}
      whileHover={{ x: 4 }}
      whileTap={{ scale: 0.98 }}
      className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl smooth-transition group relative three-d-card ${active ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'}`}
    >
      {active && (
        <motion.div 
          layoutId="active-nav"
          className="absolute inset-0 bg-primary/10 rounded-2xl border border-primary/20 shadow-[0_0_20px_rgba(var(--primary),0.15)] glass-card"
          transition={{ type: "spring", bounce: 0, duration: 0.2 }}
        />
      )}
      <div className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 three-d-inner ${
        active 
          ? 'bg-primary text-primary-foreground shadow-[0_4px_12px_rgba(var(--primary),0.4)] scale-110' 
          : 'bg-muted/30 text-muted-foreground group-hover:bg-muted/50 group-hover:text-primary group-hover:scale-110'
      }`}>
        {icon}
      </div>
      {!collapsed && <span className="relative z-10 font-bold text-sm tracking-tight three-d-inner">{label}</span>}
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
