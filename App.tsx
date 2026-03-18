import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Play, Search, RefreshCcw, Zap, User, Heart, Image as ImageIcon,
  Eye, EyeOff, Plus, Minus, TrendingUp, ChevronRight, ShieldCheck,
  ChevronLeft, Clock, ExternalLink, ChevronUp, Maximize, Minimize, 
  Download, ShieldAlert, HelpCircle, X, Archive
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { MediaItem } from './types';

// ==========================================
// 🔑 CONFIGURACIÓN NUBE (SUPABASE & ARCHIVE)
// ==========================================
const SUPABASE_URL = "https://glivvfdgsxyhzixioyjm.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsaXZ2ZmRnc3h5aHppeGlveWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3OTgzODIsImV4cCI6MjA4OTM3NDM4Mn0.BYfp1g6CG_ME0ZKjc-8xP5uQBectZvHS36uRgKgzaOU";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const ARCHIVE_HISTORY_URL = "https://archive.org/download/archivos_202603/Archivos.zip";
const ARCHIVE_LIVE_URL = "https://archive.org/download/mgf_live_2026";

const App: React.FC = () => {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [isHistoryMode, setIsHistoryMode] = useState(false);
  const [visibleCount, setVisibleCount] = useState(24);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'image' | 'video' | 'fav' | 'recent'>('all');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMediaIdx, setSelectedMediaIdx] = useState<number | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false); 
  
  // 🛡️ Estados Especiales
  const [isBlurEnabled, setIsBlurEnabled] = useState(() => JSON.parse(localStorage.getItem('isBlurEnabled') || 'true'));
  const [revealContent, setRevealContent] = useState(false);
  const [isPanicMode, setIsPanicMode] = useState(false); 
  const [isHelpOpen, setIsHelpOpen] = useState(false); 

  // 🔎 Zoom states
  const [zoomLevel, setZoomLevel] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false); 
  
  const wasMoved = useRef(false);
  const clickStartCoords = useRef({ x: 0, y: 0 });

  const [counter, setCounter] = useState(60);
  const [favorites, setFavorites] = useState<string[]>(() => JSON.parse(localStorage.getItem('favorites') || '[]'));
  const [recents, setRecents] = useState<string[]>(() => JSON.parse(localStorage.getItem('recents') || '[]'));
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const ads = [{ id: 1, imageUrl: "https://res.cloudinary.com/dgirjma4r/image/upload/v1771527191/1000346174_1_zaazob.png", linkUrl: "https://t.me/+kPSmtKmFStdiOWMx", title: "CANAL OFICIAL" }];

  useEffect(() => {
    localStorage.setItem('isBlurEnabled', JSON.stringify(isBlurEnabled));
  }, [isBlurEnabled]);

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreen) { setIsFullscreen(false); resetZoomState(); } 
        else if (isModalOpen) { setIsModalOpen(false); }
        else if (isHelpOpen) { setIsHelpOpen(false); }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isFullscreen, isModalOpen, isHelpOpen]);

  // 🔄 FETCH DATA DESDE SUPABASE
  const fetchData = async (historyMode: boolean) => {
    setIsLoading(true);
    setMediaItems([]);
    setIsHistoryMode(historyMode);

    try {
      const { data, error } = await supabase
        .from('media')
        .select('*')
        .eq('is_history', historyMode)
        .order('id', { ascending: false });

      if (error) throw error;

      const formatted = data.map((item: any, idx: number) => {
        const folder = item.type === 'video' ? 'videos' : 'images';
        
        // Determinar URL según modo
        const finalUrl = historyMode 
          ? `${ARCHIVE_HISTORY_URL}/${folder}/${encodeURIComponent(item.file)}`
          : `${ARCHIVE_LIVE_URL}/${folder}/${encodeURIComponent(item.file)}`;

        return {
          id: `supa-${item.id}`,
          title: item.type === "video" ? `Clip #${idx + 1}` : `Captura #${idx + 1}`,
          description: `Contenido de @${item.user}.`,
          type: item.type,
          url: finalUrl,
          user: item.user,
          views: item.views || 0,
          timestamp: item.timestamp || "Reciente",
          isFavorite: favorites.includes(item.file),
        };
      });
      setMediaItems(formatted);
    } catch (error) { 
        console.error("Error Supabase:", error);
        mostrarMensajeTemporal("Error al conectar con la base de datos");
    } finally { 
        setIsLoading(false); 
    }
  };

  // Carga inicial
  useEffect(() => {
    fetchData(false);
  }, []);

  // 📊 RANKING DINÁMICO DESDE SUPABASE DATA
  const topContributors = useMemo(() => {
    const counts: Record<string, number> = {};
    mediaItems.forEach(item => {
      counts[item.user] = (counts[item.user] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [mediaItems]);

  const downloadMedia = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = url.split('/').pop() || 'archivo';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) { mostrarMensajeTemporal("Error al descargar"); }
  };

  const mostrarMensajeTemporal = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const toggleFavorite = (filename: string) => {
    setFavorites(prev => {
      const next = prev.includes(filename) ? prev.filter(f => f !== filename) : [...prev, filename];
      localStorage.setItem('favorites', JSON.stringify(next));
      return next;
    });
  };

  const openMedia = (idx: number) => {
    const item = filteredMedia[idx];
    if (!item) return;
    const filename = item.url.split('/').pop() || '';
    setRecents(prev => {
      const next = [filename, ...prev.filter(f => f !== filename)].slice(0, 50);
      localStorage.setItem('recents', JSON.stringify(next));
      return next;
    });
    setSelectedMediaIdx(idx);
    setIsModalOpen(true);
    setIsFullscreen(false);
    setRevealContent(false); 
    resetZoomState();
  };

  const resetZoomState = () => {
    setZoomLevel(1);
    setPosition({ x: 0, y: 0 });
    setDragging(false);
  };

  const handleManualZoom = (delta: number) => {
    setZoomLevel(prev => {
      const next = prev + delta;
      if (next <= 1) { resetZoomState(); return 1; }
      return Math.min(next, 5);
    });
  };

  const filteredMedia = useMemo(() => {
    return mediaItems.filter(item => {
      const filename = item.url.split('/').pop() || '';
      const matchesSearch = item.user.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesUserFilter = selectedUser ? item.user === selectedUser : true;
      const matchesType = filterType === 'all' || (filterType === 'fav' && favorites.includes(filename)) || (filterType === 'recent' && recents.includes(filename)) || item.type === filterType;
      return matchesSearch && matchesType && matchesUserFilter;
    });
  }, [mediaItems, searchQuery, filterType, favorites, recents, selectedUser]);

  const selectedItem = selectedMediaIdx !== null ? filteredMedia[selectedMediaIdx] : null;

  useEffect(() => {
    const countdown = setInterval(() => setCounter(prev => (prev <= 1 ? 60 : prev - 1)), 1000);
    return () => clearInterval(countdown);
  }, []);

  // Solo auto-refrescar si estamos en modo "Nuevo"
  useEffect(() => { 
    if (counter === 60 && !isModalOpen && !isHistoryMode) {
        fetchData(false); 
    }
  }, [counter, isModalOpen, isHistoryMode]);

  useEffect(() => {
    document.body.style.overflow = (zoomLevel > 1 || isFullscreen || isPanicMode || isModalOpen) ? "hidden" : "auto";
  }, [zoomLevel, isFullscreen, isPanicMode, isModalOpen]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isBlurEnabled && !revealContent && isModalOpen) return;
    wasMoved.current = false;
    clickStartCoords.current = { x: e.clientX, y: e.clientY };
    if (zoomLevel > 1) {
      setDragging(true);
      setStartPos({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const dist = Math.hypot(e.clientX - clickStartCoords.current.x, e.clientY - clickStartCoords.current.y);
    if (dist > 5) wasMoved.current = true;
    if (dragging && zoomLevel > 1) {
      setPosition({ x: e.clientX - startPos.x, y: e.clientY - startPos.y });
    }
  };

  const handleMouseUp = () => {
    setDragging(false);
    if (!wasMoved.current && selectedItem?.type === 'image' && (!isBlurEnabled || revealContent)) {
      if (zoomLevel === 1) setZoomLevel(2.5);
      else resetZoomState();
    }
  };

  return (
    <div className="min-h-screen text-slate-200 bg-slate-950">
      {/* 🚨 PANTALLA DE PÁNICO */}
      {isPanicMode && (
        <div className="fixed inset-0 z-[1000] bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
          <button onClick={() => setIsPanicMode(false)} className="absolute top-6 right-6 p-4 text-white/10 hover:text-white transition-colors"><X className="w-8 h-8"/></button>
          <div className={`loader-circle w-16 h-16 mb-6 ${isHistoryMode ? 'border-t-blue-500' : 'border-t-mgf-red'}`}></div>
          <h2 className="text-xl font-black uppercase tracking-widest text-slate-400">Iniciando Servidor Seguro...</h2>
          <p className="text-[10px] text-slate-600 mt-2 uppercase font-bold tracking-tighter">Sincronizando base de datos cifrada, por favor espere.</p>
        </div>
      )}

      {toastMessage && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 text-white px-6 py-3 rounded-xl shadow-lg z-[300] animate-fade-down ${isHistoryMode ? 'bg-blue-600' : 'bg-mgf-red'}`}>{toastMessage}</div>
      )}

      {showScrollTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className={`fixed bottom-6 right-6 z-[100] w-14 h-14 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 border-2 border-white/20 transition-colors ${isHistoryMode ? 'bg-blue-600' : 'bg-mgf-red'}`}><ChevronUp className="w-8 h-8" /></button>
      )}

      <div className={`backdrop-blur-md py-2.5 text-center shadow-lg relative z-[60] transition-colors duration-500 ${isHistoryMode ? 'bg-blue-600/90' : 'bg-mgf-red/90'}`}>
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white animate-pulse">
            MGF NETWORK • {isHistoryMode ? 'ARCHIVO HISTÓRICO' : 'RESPALDO EN VIVO'} • {mediaItems.length} ITEMS NUBE
        </p>
      </div>

      <nav className="sticky top-0 z-50 glass-nav px-4 md:px-8 py-5">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center shadow-xl transition-colors duration-500 ${isHistoryMode ? 'bg-blue-600 shadow-blue-600/20' : 'bg-mgf-red shadow-mgf-red/20'}`}><Zap className="w-5 h-5 md:w-6 md:h-6 text-white fill-current" /></div>
            <div className="hidden sm:block">
              <h1 className="text-xl md:text-2xl font-black uppercase tracking-tighter">MGF<span className={isHistoryMode ? 'text-blue-500' : 'text-mgf-red'}>HUB</span></h1>
              <p className="text-[7px] md:text-[8px] font-bold text-slate-500 uppercase tracking-widest">Premium Content Sync</p>
            </div>
          </div>
          
          <div className="flex-1 max-w-xl relative flex items-center gap-2 md:gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input type="text" placeholder="Buscar por usuario..." className="w-full bg-slate-900/50 border border-white/5 rounded-2xl py-3 pl-14 pr-6 text-sm outline-none focus:border-mgf-red/50 transition-all" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            
            <div className="flex items-center gap-1.5 bg-slate-900/50 p-1.5 rounded-2xl border border-white/5">
              <button onClick={() => setIsBlurEnabled(!isBlurEnabled)} className={`p-2 rounded-xl transition-all ${isBlurEnabled ? (isHistoryMode ? 'bg-blue-600 text-white' : 'bg-mgf-red text-white') : 'text-slate-500 hover:text-white'}`}>{isBlurEnabled ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
              <button onClick={() => setIsPanicMode(true)} className="p-2 rounded-xl text-slate-500 hover:text-red-500 transition-all"><ShieldAlert className="w-5 h-5"/></button>
              <button onClick={() => setIsHelpOpen(true)} className="p-2 rounded-xl text-slate-500 hover:text-blue-500 transition-all"><HelpCircle className="w-5 h-5"/></button>
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-6">
            <div className="text-right hidden md:block">
                <p className="text-[8px] font-black text-slate-500 uppercase">{isHistoryMode ? 'modo histórico' : 'sincronizando en:'}</p>
                <p className={`text-xs font-black ${isHistoryMode ? 'text-blue-500' : 'text-mgf-red'}`}>{isHistoryMode ? 'ESTÁTICO' : `${counter}s`}</p>
            </div>
            <button onClick={() => fetchData(isHistoryMode)} className={`p-3 md:p-4 rounded-xl md:rounded-2xl text-white transition-all active:scale-95 ${isHistoryMode ? 'bg-blue-600' : 'bg-mgf-red'}`}><RefreshCcw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} /></button>
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-10 grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10">
        <aside className="lg:col-span-3 space-y-6">
          <div className="glass-panel rounded-[2rem] p-6 border border-white/5">
            <div className="flex items-center justify-between mb-6">
              <div className={`flex items-center gap-3 ${isHistoryMode ? 'text-blue-500' : 'text-mgf-red'}`}><TrendingUp className="w-5 h-5" /><h3 className="text-[10px] font-black uppercase tracking-widest">Ranking Supabase</h3></div>
              {selectedUser && <button onClick={() => setSelectedUser(null)} className="text-[8px] font-black text-white/40 uppercase">Limpiar</button>}
            </div>
            <div className="space-y-4">
              {topContributors.map(([user, count]) => (
                <div key={user} onClick={() => setSelectedUser(selectedUser === user ? null : user)} className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${selectedUser === user ? (isHistoryMode ? 'bg-blue-600 border-transparent scale-105 shadow-lg' : 'bg-mgf-red border-transparent scale-105 shadow-lg') : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
                  <span className="text-xs font-bold truncate">@{user}</span>
                  <div className="flex items-center gap-2"><ImageIcon className="w-3 h-3 text-slate-500" /><span className="text-[10px] font-black">{count}</span></div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="glass-panel rounded-[2rem] p-4 border border-white/5 flex flex-col items-center justify-center h-[100px] cursor-pointer" onClick={() => window.open('https://t.me/+mcjNuQLKTgk0MjUx', '_blank')}>
            <p className={`text-lg font-black italic transition-colors ${isHistoryMode ? 'text-blue-400' : 'text-red-400'}`}>Únete al grupo</p>
          </div>

          <div className={`p-6 rounded-[2rem] border flex items-center gap-4 transition-colors ${isHistoryMode ? 'bg-blue-600/5 border-blue-600/10' : 'bg-mgf-red/5 border-mgf-red/10'}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isHistoryMode ? 'bg-blue-600/10 text-blue-500' : 'bg-mgf-red/10 text-mgf-red'}`}><ShieldCheck className="w-5 h-5" /></div>
            <div><p className="text-[9px] font-black uppercase text-slate-500">Estado Nodo</p><p className="text-[10px] font-bold text-white uppercase tracking-tight">{isHistoryMode ? 'Supabase Nube' : 'Cifrado & Activo'}</p></div>
          </div>

          <div className="sticky top-24 pt-2 space-y-4">
            {ads.map((ad) => (
              <div key={ad.id} className="glass-panel rounded-[2rem] border border-white/5 overflow-hidden group shadow-2xl">
                <div className={`p-3 border-b border-white/5 flex items-center justify-between bg-white/5 text-[9px] font-black uppercase ${isHistoryMode ? 'text-blue-500' : 'text-mgf-red'}`}><span>Anuncio</span><div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isHistoryMode ? 'bg-blue-500' : 'bg-mgf-red'}`} /></div>
                <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer" className="block relative aspect-video overflow-hidden">
                  <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 flex items-end p-4"><div className="flex items-center justify-between w-full"><p className="text-[10px] font-black uppercase text-white tracking-tighter">{ad.title}</p><ExternalLink className="w-3 h-3 text-white/50" /></div></div>
                </a>
              </div>
            ))}
          </div>
        </aside>

        <div className="lg:col-span-9">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <div className="flex gap-2 mb-4">
                <button 
                    onClick={() => fetchData(false)} 
                    className={`px-5 py-2 rounded-xl text-[10px] font-black transition-all ${!isHistoryMode ? "bg-mgf-red text-white" : "bg-slate-800 text-white hover:bg-slate-700"}`}
                >
                    🆕 Nuevo (Archive Live)
                </button>
                <button 
                    onClick={() => fetchData(true)} 
                    className={`px-5 py-2 rounded-xl text-[10px] font-black transition-all ${isHistoryMode ? "bg-blue-600 text-white" : "bg-slate-800 text-white hover:bg-slate-700"}`}
                >
                    📜 Historial (Archive ZIP)
                </button>
              </div> 
              <h2 className="text-3xl md:text-5xl font-black tracking-tighter">
                {isHistoryMode ? 'Archivo' : 'Galería'} <span className={isHistoryMode ? 'text-blue-500' : 'text-mgf-red'}>{selectedUser ? `@${selectedUser}` : 'MGF'}</span>
              </h2>
            </div>
            <div className="flex flex-wrap gap-1.5 p-1 glass-panel rounded-2xl overflow-x-auto">
              {['all', 'video', 'image', 'fav', 'recent'].map(t => (
                <button key={t} onClick={() => { setFilterType(t as any); setSelectedUser(null); }} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${filterType === t && !selectedUser ? (isHistoryMode ? 'bg-blue-600 text-white' : 'bg-mgf-red text-white') : 'text-slate-500 hover:text-white'}`}>{t}</button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="h-[50vh] flex flex-col items-center justify-center"><div className={`loader-circle mb-6 ${isHistoryMode ? 'border-t-blue-500' : 'border-t-mgf-red'}`} /><p className={`text-[10px] font-black uppercase animate-pulse ${isHistoryMode ? 'text-blue-500' : 'text-mgf-red'}`}>Consultando Supabase...</p></div>
          ) : mediaItems.length === 0 ? (
            <div className="h-[40vh] flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[3rem]">
               <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                  {isHistoryMode ? <Archive className="text-blue-500 w-8 h-8"/> : <Zap className="text-mgf-red w-8 h-8"/>}
               </div>
               <p className="text-xs font-black uppercase tracking-widest text-slate-500 text-center">
                  {isHistoryMode ? "No hay registros de historial en Supabase" : "No hay contenido nuevo en vivo"}
               </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredMedia.slice(0, visibleCount).map((item, idx) => (
                  <div key={item.id} className="card-premium glass-panel rounded-[1.5rem] p-3 group cursor-pointer" onClick={() => openMedia(idx)}>
                    <div className="relative aspect-[3/4] rounded-[1.2rem] overflow-hidden mb-4 bg-black">
                      <div className={`w-full h-full transition-all duration-500 ${isBlurEnabled ? 'blur-2xl scale-110 opacity-50' : ''}`}>
                        {item.type === 'video' ? (
                          <div className="w-full h-full relative"><Play className="absolute inset-0 m-auto w-10 h-10 text-white/50 z-20" /><video src={item.url} className="w-full h-full object-cover" muted /></div>
                        ) : <img src={item.url} className="w-full h-full object-cover" />}
                      </div>
                      {isBlurEnabled && (
                        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                          <span className="bg-black/60 px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border border-white/10 backdrop-blur-sm">Protegido</span>
                        </div>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); toggleFavorite(item.url.split('/').pop() || ''); }} className={`absolute top-3 right-3 z-20 w-8 h-8 rounded-lg flex items-center justify-center backdrop-blur-md border border-white/10 ${item.isFavorite ? (isHistoryMode ? 'bg-blue-600' : 'bg-mgf-red') : 'bg-black/30'}`}><Heart className={`w-3.5 h-3.5 ${item.isFavorite ? 'fill-white text-white' : 'text-white'}`} /></button>
                    </div>
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2"><User className={`w-3.5 h-3.5 ${isHistoryMode ? 'text-blue-500' : 'text-mgf-red'}`} /><p className="text-[10px] font-bold">@{item.user}</p></div>
                      <div className="flex items-center gap-1 text-slate-500"><Clock className="w-3 h-3" /><span className="text-[10px] font-black">{item.timestamp}</span></div>
                    </div>
                  </div>
                ))}
              </div>
              {filteredMedia.length > visibleCount && (
                <div className="mt-12 text-center">
                  <button onClick={() => setVisibleCount(v => v + 24)} className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest text-white shadow-lg hover:scale-105 transition-transform ${isHistoryMode ? 'bg-blue-600 shadow-blue-600/20' : 'bg-mgf-red shadow-mgf-red/20'}`}>Cargar más de la nube</button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* 📖 MODAL DE AYUDA */}
      {isHelpOpen && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setIsHelpOpen(false)} />
          <div className="relative glass-panel max-w-lg w-full p-8 rounded-[2.5rem] border border-white/10 shadow-2xl">
            <h3 className="text-2xl font-black mb-6 flex items-center gap-3"><HelpCircle className="text-mgf-red w-6 h-6"/> Manual de Usuario Pro</h3>
            <div className="space-y-6 text-sm text-slate-300">
              <div className="flex gap-4"><div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0"><Archive className="w-4 h-4 text-white"/></div><p><b>Historial:</b> Datos en Supabase, archivos en Archive.org ZIP.</p></div>
              <div className="flex gap-4"><div className="w-8 h-8 rounded-lg bg-mgf-red flex items-center justify-center shrink-0"><Zap className="w-4 h-4 text-white"/></div><p><b>Nuevo:</b> Datos en Supabase, archivos sueltos en Archive.org.</p></div>
              <div className="flex gap-4"><div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0"><EyeOff className="w-4 h-4 text-white"/></div><p><b>Revelar:</b> Al habilitar, haz click en el botón central del visualizador para quitar el desenfoque.</p></div>
            </div>
            <button onClick={() => setIsHelpOpen(false)} className="w-full py-4 mt-8 rounded-2xl bg-mgf-red text-white font-black uppercase text-[10px] tracking-widest">Entendido</button>
          </div>
        </div>
      )}

      {/* Visualizador Fullscreen */}
      {isFullscreen && selectedItem && (
        <div className="fixed inset-0 z-[500] bg-black flex items-center justify-center overflow-hidden">
          <button onClick={() => { setIsFullscreen(false); resetZoomState(); }} className="absolute top-6 right-6 z-[510] w-12 h-12 bg-white/10 hover:bg-mgf-red rounded-full flex items-center justify-center transition-all"><Minimize className="w-6 h-6" /></button>
          <div className="w-full h-full flex items-center justify-center" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onMouseDown={handleMouseDown}>
            <img src={selectedItem.url} draggable={false} style={{ transform: `scale(${zoomLevel}) translate(${position.x/zoomLevel}px, ${position.y/zoomLevel}px)`, transition: dragging ? "none" : "transform 0.3s ease", cursor: zoomLevel > 1 ? "grabbing" : "zoom-in" }} className="max-w-full max-h-full object-contain" />
          </div>
        </div>
      )}

      {/* Modal Principal */}
      {isModalOpen && selectedItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-10">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-2xl" onClick={() => setIsModalOpen(false)} />
          <div className="relative glass-panel w-full max-w-6xl h-full md:h-auto md:max-h-[85vh] md:rounded-[3rem] overflow-hidden flex flex-col md:flex-row shadow-2xl">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 md:top-8 md:right-8 z-[210] w-10 h-10 bg-slate-900/50 rounded-full flex items-center justify-center hover:bg-mgf-red text-white transition-all"><Plus className="w-6 h-6 rotate-45" /></button>
            
            <div className="h-[65vh] md:h-auto md:w-3/4 bg-black flex items-center justify-center relative group overflow-hidden">
              <button onClick={() => { setSelectedMediaIdx((selectedMediaIdx! - 1 + filteredMedia.length) % filteredMedia.length); setRevealContent(false); resetZoomState(); }} className={`absolute left-4 z-[50] w-10 h-10 rounded-full text-white transition-all backdrop-blur-md border border-white/10 flex items-center justify-center ${isHistoryMode ? 'bg-white/10 hover:bg-blue-600' : 'bg-white/10 hover:bg-mgf-red'}`}><ChevronLeft/></button>
              <button onClick={() => { setSelectedMediaIdx((selectedMediaIdx! + 1) % filteredMedia.length); setRevealContent(false); resetZoomState(); }} className={`absolute right-4 z-[50] w-10 h-10 rounded-full text-white transition-all backdrop-blur-md border border-white/10 flex items-center justify-center ${isHistoryMode ? 'bg-white/10 hover:bg-blue-600' : 'bg-white/10 hover:bg-mgf-red'}`}><ChevronRight/></button>
              
              <div className="w-full h-full flex items-center justify-center overflow-hidden relative" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onMouseDown={handleMouseDown}>
                <div className={`w-full h-full flex items-center justify-center transition-all duration-700 ${isBlurEnabled && !revealContent ? 'blur-3xl scale-125' : ''}`}>
                  {selectedItem.type === 'video' ? (
                    <video src={selectedItem.url} autoPlay loop controls={(!isBlurEnabled || revealContent) && zoomLevel === 1} className="w-full h-full object-contain" style={{ transform: `scale(${zoomLevel}) translate(${position.x/zoomLevel}px, ${position.y/zoomLevel}px)`, transition: dragging ? "none" : "transform 0.3s ease" }} />
                  ) : (
                    <img src={selectedItem.url} draggable={false} className="max-w-full max-h-full object-contain" style={{ transform: `scale(${zoomLevel}) translate(${position.x/zoomLevel}px, ${position.y/zoomLevel}px)`, transition: dragging ? "none" : "transform 0.3s ease", cursor: (!isBlurEnabled || revealContent) ? (zoomLevel > 1 ? "grabbing" : "zoom-in") : "default" }} />
                  )}
                </div>
                {isBlurEnabled && !revealContent && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center z-40 bg-black/20 backdrop-blur-sm">
                    <button onClick={() => setRevealContent(true)} className={`px-8 py-4 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-2xl hover:scale-110 transition-transform flex items-center gap-3 ${isHistoryMode ? 'bg-blue-600' : 'bg-mgf-red'}`}><Eye className="w-5 h-5" /> Revelar Contenido</button>
                  </div>
                )}
                {(!isBlurEnabled || revealContent) && (
                   <div className="absolute top-6 left-6 z-40 flex flex-col gap-2 pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity">
                      {selectedItem.type === 'video' ? (
                        <div className="flex flex-col gap-2 bg-black/40 backdrop-blur-md p-2 rounded-xl border border-white/10">
                          <button onClick={(e) => { e.stopPropagation(); handleManualZoom(0.5); }} className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors"><Plus className="w-5 h-5"/></button>
                          <button onClick={(e) => { e.stopPropagation(); handleManualZoom(-0.5); }} className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors"><Minus className="w-5 h-5"/></button>
                        </div>
                      ) : (
                        <button onClick={() => setIsFullscreen(true)} className={`w-14 h-14 rounded-2xl flex items-center justify-center border border-white/20 transition-all opacity-100 bg-white/10 ${isHistoryMode ? 'hover:bg-blue-600' : 'hover:bg-mgf-red'}`}><Maximize className="w-7 h-7" /></button>
                      )}
                   </div>
                )}
              </div>
            </div>
            
            <div className="flex-1 p-6 md:p-10 flex flex-col justify-between bg-mgf-dark/50 border-t md:border-t-0 md:border-l border-white/5 overflow-y-auto">
              <div className="space-y-6">
                <div className={`flex items-center gap-2 ${isHistoryMode ? 'text-blue-500' : 'text-mgf-red'}`}><Clock className="w-4 h-4" /><span className="text-[10px] font-black uppercase tracking-widest">{isHistoryMode ? 'Nube Histórica' : 'Nube Live'}</span></div>
                <h3 className="text-xl md:text-3xl font-black tracking-tighter">{isHistoryMode ? 'Archive Pro ZIP' : 'Archive Pro Live'}</h3>
                <div className="flex flex-col gap-3">
                  <div className="p-4 bg-white/5 rounded-2xl">
                    <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Enviado por</p>
                    <p className="text-lg font-black truncate">@{selectedItem.user}</p>
                    <p className="text-[9px] mt-2 text-slate-500 font-bold uppercase tracking-tighter">Fecha Nube: {selectedItem.timestamp}</p>
                  </div>
                  <button onClick={() => downloadMedia(selectedItem.url)} className={`flex items-center justify-center gap-3 w-full py-4 bg-white/10 hover:text-white rounded-2xl border border-white/5 text-[10px] font-black uppercase transition-all group ${isHistoryMode ? 'hover:bg-blue-600' : 'hover:bg-mgf-red'}`}><Download className={`w-4 h-4 group-hover:text-white ${isHistoryMode ? 'text-blue-500' : 'text-mgf-red'}`} /> Descargar Media</button>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className={`w-full py-4 mt-6 rounded-xl md:rounded-2xl font-black text-[10px] uppercase text-white shadow-xl ${isHistoryMode ? 'bg-blue-600 shadow-blue-600/20' : 'bg-mgf-red shadow-mgf-red/20'}`}>Cerrar Galería</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;