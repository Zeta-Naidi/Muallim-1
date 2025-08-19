import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, User, ChevronDown, GraduationCap, Bell, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, query, where, orderBy, updateDoc, doc, onSnapshot, limit, getDocs, deleteDoc, addDoc, getDoc } from 'firebase/firestore';
import { showToast } from '../ui/Toast';
import { db } from '../../services/firebase';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

export const Header: React.FC = () => {
  const { userProfile, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  // Notifications
  const [showNotif, setShowNotif] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const [isLoadingNotifs, setIsLoadingNotifs] = useState(false);
  type AppNotification = { id: string; title?: string; message?: string; createdAt?: Date; read?: boolean };
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [hasUnread, setHasUnread] = useState<boolean>(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const handleLogout = async () => {
    try {
      await logout();
      setShowUserMenu(false);
    } catch (error) {
      console.error('Errore durante il logout:', error);
      setShowUserMenu(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotif(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Real-time notifications subscription (full list) for panel content
  useEffect(() => {
    if (!userProfile) return;
    if (!showNotif) return; // only load full list when panel is open
    setIsLoadingNotifs(true);
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', userProfile.id),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const list: AppNotification[] = snap.docs.map(d => {
        const data: any = d.data();
        return {
          id: d.id,
          title: data.title,
          message: data.message,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : undefined),
          read: !!data.read,
        };
      });
      setNotifications(list);
      setIsLoadingNotifs(false);
    }, (e) => {
      console.error('Errore sottoscrivendo notifiche', e);
      setIsLoadingNotifs(false);
    });
    return () => unsub();
  }, [userProfile, showNotif]);

  // Subscribe to user-level hasUnread flag for instant bell updates
  useEffect(() => {
    if (!userProfile) return;
    const userDocRef = doc(db, 'users', userProfile.id);
    const unsub = onSnapshot(userDocRef, (snap) => {
      const data: any = snap.data();
      setHasUnread(!!data?.hasUnread);
    }, (e) => {
      console.error('Errore sottoscrivendo flag utente hasUnread', e);
    });
    return () => unsub();
  }, [userProfile]);

  // Notification creation for pending teachers is disabled

  // Live unread count for badge
  useEffect(() => {
    if (!userProfile) return;
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', userProfile.id),
      where('read', '==', false)
    );
    const unsub = onSnapshot(q, (snap) => {
      setUnreadCount(snap.size);
    }, (e) => {
      console.error('Errore conteggio non lette', e);
    });
    return () => unsub();
  }, [userProfile]);

  const getMenuItems = () => {
    const baseItems = [{ path: '/dashboard', label: 'Dashboard' }];

    if (userProfile?.role === 'student') {
      return [
        ...baseItems,
        { path: '/student/grades', label: 'Le Mie Valutazioni' },
        { path: '/lessons', label: 'Le Mie Lezioni' },
        { path: '/homework', label: 'Compiti' },
        { path: '/materials', label: 'Materiali' },
        { path: '/my-attendance', label: 'Le Mie Presenze' },
      ];
    }

    if (userProfile?.role === 'teacher') {
      return [
        ...baseItems,
        { path: '/teacher/classes', label: 'Le Mie Classi' },
        { path: '/teacher/grades', label: 'Valutazioni' },
        { path: '/attendance', label: 'Presenze' },
        { path: '/homework', label: 'Compiti' },
        { path: '/lessons', label: 'Lezioni' },
        { path: '/materials', label: 'Materiali' },
      ];
    }

    if (userProfile?.role === 'admin') {
      return [
        ...baseItems,
        { path: '/admin/classes', label: 'Classi' },
        { path: '/admin/teachers', label: 'Insegnanti' },
        { path: '/admin/students', label: 'Studenti' },
        { path: '/admin/payments', label: 'Pagamenti' },
        { path: '/admin/users', label: 'Utenti' },
      ];
    }

    return baseItems;
  };

  const menuItems = getMenuItems();

  return (
    <header className="bg-white/95 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center group-hover:scale-105 transition-all duration-300 shadow-md">
                <GraduationCap className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-medium bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Muallim
              </span>
            </Link>
          </div>

          {/* Menu Desktop */}
          <nav className="hidden md:flex space-x-1 items-center" aria-label="Main navigation">
            {userProfile && menuItems.map((item) => {
              const isActive = location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 relative group ${
                    isActive
                      ? 'text-blue-700 font-semibold'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 w-6 h-0.5 bg-blue-600 -translate-x-1/2 rounded-full"></span>
                  )}
                </Link>
              );
            })}

            {userProfile ? (
              <div className="relative ml-6" ref={menuRef}>
                <div className="flex items-center space-x-4">
                  <div className="relative" ref={notifRef}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNotif(v => !v);
                        setShowUserMenu(false);
                      }}
                      className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      aria-label="Notifiche"
                    >
                      <Bell className="h-5 w-5" />
                      {(unreadCount > 0 || hasUnread) && (
                        <span className="absolute -top-1 -right-1 min-w-[18px] h-4 px-1 bg-red-600 text-[10px] text-white rounded-full flex items-center justify-center">
                          {unreadCount > 0 ? unreadCount : ''}
                        </span>
                      )}
                    </button>
                    <AnimatePresence>
                      {showNotif && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 8 }}
                          transition={{ duration: 0.15 }}
                          className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg z-50 border border-gray-100 ring-1 ring-black ring-opacity-5"
                          role="menu"
                          aria-orientation="vertical"
                          tabIndex={-1}
                        >
                          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                            <div className="font-medium text-gray-900">Notifiche</div>
                            <div className="flex items-center gap-3">
                              {(hasUnread || notifications.some(n => !n.read)) && (
                                <button
                                  className="text-xs text-blue-600 hover:text-blue-800"
                                  onClick={async () => {
                                    try {
                                      if (!userProfile) return;
                                      const qUnread = query(
                                        collection(db, 'notifications'),
                                        where('recipientId', '==', userProfile.id),
                                        where('read', '==', false)
                                      );
                                      const snap = await getDocs(qUnread);
                                      await Promise.all(snap.docs.map(d => updateDoc(doc(db, 'notifications', d.id), { read: true })));
                                      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                                      await updateDoc(doc(db, 'users', userProfile.id), { hasUnread: false });
                                      showToast.success('Tutte le notifiche sono state segnate come lette');
                                    } catch (e) {
                                      console.warn('Impossibile segnare tutte come lette', e);
                                      showToast.error('Errore nel segnare come lette');
                                    }
                                  }}
                                >
                                  Segna tutte come lette
                                </button>
                              )}
                              {notifications.length > 0 && (
                                <button
                                  className="text-xs text-red-600 hover:text-red-800"
                                  onClick={async () => {
                                    try {
                                      if (!userProfile) return;
                                      const qAll = query(
                                        collection(db, 'notifications'),
                                        where('recipientId', '==', userProfile.id)
                                      );
                                      const snap = await getDocs(qAll);
                                      await Promise.all(snap.docs.map(d => deleteDoc(doc(db, 'notifications', d.id))));
                                      setNotifications([]);
                                      await updateDoc(doc(db, 'users', userProfile.id), { hasUnread: false });
                                      showToast.success('Notifiche cancellate');
                                    } catch (e) {
                                      console.warn('Impossibile cancellare le notifiche', e);
                                      showToast.error('Errore cancellando le notifiche');
                                    }
                                  }}
                                >
                                  Cancella tutte
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="max-h-80 overflow-y-auto">
                            {isLoadingNotifs ? (
                              <div className="p-4 text-sm text-gray-600">Caricamento...</div>
                            ) : notifications.length === 0 ? (
                              <div className="p-4 text-sm text-gray-500">Nessuna notifica</div>
                            ) : (
                              <ul className="divide-y divide-gray-100">
                                {notifications.map(n => (
                                  <li key={n.id} className="p-3 hover:bg-gray-50 group">
                                    <div className="flex items-start gap-2">
                                      <div className={`mt-1 h-2 w-2 rounded-full ${n.read ? 'bg-gray-300' : 'bg-blue-600'}`}></div>
                                      <div 
                                        className="flex-1 cursor-pointer"
                                        onClick={async () => {
                                          // mark as read
                                          try {
                                            if (!n.read) {
                                              await updateDoc(doc(db, 'notifications', n.id), { read: true });
                                              setNotifications(prev => prev.map(it => it.id === n.id ? { ...it, read: true } : it));
                                              // if no more unread, clear user flag
                                              try {
                                                const q = query(collection(db, 'notifications'), where('recipientId', '==', userProfile!.id), where('read', '==', false), limit(1));
                                                const res = await getDocs(q);
                                                if (res.empty) {
                                                  await updateDoc(doc(db, 'users', userProfile!.id), { hasUnread: false });
                                                }
                                              } catch (flagErr) {
                                                console.warn('Impossibile aggiornare flag utente hasUnread:', flagErr);
                                              }
                                            }
                                          } catch (err) {
                                            console.warn('Impossibile aggiornare notifica', err);
                                          }
                                        }}
                                      >
                                        <div className="text-sm text-gray-900">{n.title || 'Notifica'}</div>
                                        {n.message && <div className="text-xs text-gray-600 mt-0.5">{n.message}</div>}
                                        {n.createdAt && (
                                          <div className="text-[11px] text-gray-400 mt-1">{format(n.createdAt, 'dd MMM yyyy HH:mm', { locale: it })}</div>
                                        )}
                                      </div>
                                      <button
                                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 transition-all"
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          try {
                                            // If this is a pending teacher notification, mark it as dismissed FIRST
                                            if ((n as any).type === 'pending_teacher' && (n as any).entityId) {
                                              const userDocRef = doc(db, 'users', userProfile!.id);
                                              const userDocSnap = await getDoc(userDocRef);
                                              const currentData = userDocSnap.data() || {};
                                              const dismissed = currentData.dismissedPendingTeachers || [];
                                              if (!dismissed.includes((n as any).entityId)) {
                                                await updateDoc(userDocRef, {
                                                  dismissedPendingTeachers: [...dismissed, (n as any).entityId]
                                                });
                                              }
                                            }
                                            
                                            // Then delete the notification
                                            await deleteDoc(doc(db, 'notifications', n.id));
                                            setNotifications(prev => prev.filter(it => it.id !== n.id));
                                            
                                            // Check if we need to update hasUnread flag
                                            const remaining = notifications.filter(it => it.id !== n.id && !it.read);
                                            if (remaining.length === 0) {
                                              await updateDoc(doc(db, 'users', userProfile!.id), { hasUnread: false });
                                            }
                                            showToast.success('Notifica eliminata');
                                          } catch (err) {
                                            console.warn('Impossibile eliminare notifica', err);
                                            showToast.error('Errore nell\'eliminazione');
                                          }
                                        }}
                                        title="Elimina notifica"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="h-8 w-px bg-gray-200"></div>
                  <button
                    onClick={() => {
                      setShowUserMenu(!showUserMenu);
                      setShowNotif(false);
                    }}
                    className="flex items-center text-sm font-medium text-gray-700 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 hover:bg-gray-50 rounded-xl px-3 py-2 transition-all duration-200"
                    aria-expanded={showUserMenu}
                    aria-haspopup="true"
                    aria-label="Menu utente"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-medium text-sm shadow-sm">
                      {userProfile.displayName.charAt(0).toUpperCase()}
                    </div>
                    <span className="mx-2 hidden sm:inline-block truncate max-w-[120px]">
                      {userProfile.displayName}
                    </span>
                    <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showUserMenu ? 'transform rotate-180' : ''}`} />
                  </button>
                </div>

                <AnimatePresence>
                  {showUserMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-lg py-1 z-50 border border-gray-100 ring-1 ring-black ring-opacity-5 focus:outline-none"
                      role="menu"
                      aria-orientation="vertical"
                      aria-labelledby="user-menu-button"
                      tabIndex={-1}
                    >
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-sm font-medium text-gray-900 truncate">{userProfile.displayName}</p>
                        <p className="text-xs text-gray-500 truncate">{userProfile.email}</p>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-2">
                          {userProfile.role === 'admin' ? 'Amministratore' :
                            userProfile.role === 'teacher' ? 'Insegnante' : 'Studente'}
                        </span>
                      </div>
                      <div className="py-1">
                        <button
                          onClick={() => {
                            navigate('/profile');
                            setShowUserMenu(false);
                          }}
                          className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150"
                          role="menuitem"
                        >
                          <User className="mr-3 h-5 w-5 text-gray-400" />
                          <span>Il mio profilo</span>
                        </button>
                        
                      </div>
                      <div className="border-t border-gray-100">
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors duration-150"
                          role="menuitem"
                        >
                          <LogOut className="mr-3 h-5 w-5 text-red-400" />
                          <span>Esci</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link to="/login">
                <Button variant="primary" size="lg" className="anime-button">Accedi</Button>
              </Link>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            {userProfile && (
              <button
                onClick={toggleMenu}
                className="text-gray-700 hover:text-blue-700 focus:outline-none p-2 rounded-full hover:bg-gray-100 transition-colors"
                aria-expanded={isOpen}
                aria-label={isOpen ? 'Chiudi menu' : 'Apri menu'}
              >
                {isOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
            )}

            {!userProfile && (
              <Link to="/login">
                <Button 
                  variant="primary" 
                  size="lg" 
                  className="text-sm font-medium px-4 py-2"
                >
                  Accedi
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="md:hidden bg-white shadow-lg rounded-b-lg overflow-hidden"
          >
            <div className="px-2 pt-2 pb-3 space-y-1">
              {menuItems.map((item) => {
                const isActive = location.pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsOpen(false)}
                    className={`block px-4 py-3 rounded-lg text-base font-medium ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                );
              })}

              <div className="border-t border-gray-100 mt-2 pt-2">
                <div className="px-4 py-3">
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-medium text-sm mr-3">
                      {userProfile?.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{userProfile?.displayName}</p>
                      <p className="text-xs text-gray-500 truncate">{userProfile?.email}</p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    navigate('/profile');
                    setIsOpen(false);
                  }}
                  className="flex w-full items-center px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
                >
                  <User className="mr-3 h-5 w-5 text-gray-400" />
                  Il mio profilo
                </button>
                <a
                  href="#"
                  className="flex w-full items-center px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
                >
                  <svg className="mr-3 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Impostazioni
                </a>
                <button
                  onClick={() => {
                    handleLogout();
                    setIsOpen(false);
                  }}
                  className="flex w-full items-center px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <LogOut className="mr-3 h-5 w-5 text-red-400" />
                  Esci
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
