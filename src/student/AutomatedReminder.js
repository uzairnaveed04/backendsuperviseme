import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Modal,
  Pressable,
  Animated,
  Easing,
  Dimensions,
  Image,
  ScrollView
} from 'react-native';

import { getAuth, onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  query,
  where,
  orderBy,
  Timestamp,
  doc,
  deleteDoc,
  addDoc,
  getDoc,
  getDocs,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';

import { db } from '../../firebaseConfig';
import LinearGradient from 'react-native-linear-gradient';
import * as Animatable from 'react-native-animatable';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ConfettiCannon from 'react-native-confetti-cannon';

const { width, height } = Dimensions.get('window');

const THEMES = {
  light: {
    primary: '#6366F1',
    secondary: '#8B5CF6',
    tertiary: '#06B6D4',
    background: '#F8FAFC',
    card: '#FFFFFF',
    text: '#1E293B',
    accent: '#EC4899',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    muted: '#94A3B8',
    gradientStart: '#6366F1',
    gradientEnd: '#8B5CF6'
  },
};

const getCountdownColor = (diffInMs) => {
  const hours = diffInMs / (1000 * 60 * 60);
  if (hours < 24) return THEMES.light.danger;
  if (hours < 72) return THEMES.light.warning;
  return THEMES.light.success;
};

const ReminderItem = ({ reminder, onExpired, index }) => {
  const [countdown, setCountdown] = useState('');
  const [color, setColor] = useState(THEMES.light.success);
  const pulseAnim = useState(new Animated.Value(1))[0];
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(50))[0];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        delay: index * 100,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        delay: index * 100,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  useEffect(() => {
    const pulse = () => {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.03,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start(() => pulse());
    };

    if (reminder.priority === 'high') {
      pulse();
    }

    return () => pulseAnim.stopAnimation();
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      const now = new Date();
      const deadline = reminder.deadline.toDate();
      const diff = deadline.getTime() - now.getTime();

      try {
        if (reminder.taskId) {
          const taskRef = doc(db, 'tasks', reminder.taskId);
          const taskSnap = await getDoc(taskRef);
          if (taskSnap.exists() && taskSnap.data().status === 'completed') {
            clearInterval(interval);
            const reminderRef = doc(db, 'reminders', reminder.id);
            await addDoc(collection(db, 'reminderHistory'), {
              ...reminder,
              movedAt: Timestamp.now(),
              reason: '✅ Task completed before deadline',
            });
            await deleteDoc(reminderRef);
            onExpired(reminder.id);
            return;
          }
        }

        if (diff <= 0) {
          setCountdown('⏰ Deadline passed!');
          clearInterval(interval);
          const reminderRef = doc(db, 'reminders', reminder.id);
          await addDoc(collection(db, 'reminderHistory'), {
            ...reminder,
            movedAt: Timestamp.now(),
            reason: '⌛ Deadline passed',
          });
          await deleteDoc(reminderRef);
          onExpired(reminder.id);
          return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / (1000 * 60)) % 60);
        const seconds = Math.floor((diff / 1000) % 60);
        setCountdown(`${days}d ${hours}h ${minutes}m ${seconds}s`);
        setColor(getCountdownColor(diff));
      } catch (err) {
        console.error('Error handling reminder:', err);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [reminder]);

  const getPriorityIcon = () => {
    switch (reminder.priority) {
      case 'high': return { name: 'alert-circle', color: THEMES.light.danger };
      case 'medium': return { name: 'time', color: THEMES.light.warning };
      default: return { name: 'checkmark-circle', color: THEMES.light.success };
    }
  };

  const priorityIcon = getPriorityIcon();

  return (
    <Animated.View 
      style={[
        styles.cardContainer,
        { 
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <Animated.View style={[
        styles.card,
        { 
          transform: [{ scale: pulseAnim }],
          borderLeftWidth: 6,
          borderLeftColor: color,
        }
      ]}>
        <View style={styles.cardHeader}>
          <LinearGradient
            colors={['rgba(99, 102, 241, 0.1)', 'rgba(139, 92, 246, 0.1)']}
            style={styles.reminderIconContainer}
          >
            <Ionicons 
              name="notifications" 
              size={24} 
              color={color}
            />
          </LinearGradient>
          
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{reminder.title || 'Reminder'}</Text>
            <Text style={styles.subtitle}>Task Deadline</Text>
          </View>
          
          {reminder.priority === 'high' && (
            <LinearGradient
              colors={['rgba(239, 68, 68, 0.1)', 'rgba(220, 38, 38, 0.1)']}
              style={styles.priorityBadge}
            >
              <Ionicons name="flash" size={14} color={THEMES.light.danger} />
              <Text style={styles.priorityText}>High Priority</Text>
            </LinearGradient>
          )}
        </View>
        
        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <LinearGradient
              colors={['rgba(99, 102, 241, 0.1)', 'rgba(139, 92, 246, 0.1)']}
              style={styles.detailIcon}
            >
              <Ionicons name="person" size={14} color={THEMES.light.primary} />
            </LinearGradient>
            <Text style={styles.detailText}>Supervisor: {reminder.supervisorEmail}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <LinearGradient
              colors={['rgba(99, 102, 241, 0.1)', 'rgba(139, 92, 246, 0.1)']}
              style={styles.detailIcon}
            >
              <Ionicons name="calendar" size={14} color={THEMES.light.primary} />
            </LinearGradient>
            <Text style={styles.detailText}>
              Due: {reminder.deadline.toDate().toLocaleDateString()}
            </Text>
          </View>
        </View>
        
        <LinearGradient
          colors={['rgba(99, 102, 241, 0.05)', 'rgba(139, 92, 246, 0.05)']}
          style={styles.countdownContainer}
        >
          <View style={styles.countdownContent}>
            <Ionicons name="time" size={20} color={color} />
            <Text style={[styles.countdown, { color }]}>
              {countdown}
            </Text>
          </View>
          <View style={[styles.countdownIndicator, { backgroundColor: color }]} />
        </LinearGradient>
      </Animated.View>
    </Animated.View>
  );
};

const AutomatedReminder = () => {
  const [email, setEmail] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState({ visible: false, title: '', message: '' });
  const [showConfetti, setShowConfetti] = useState(false);
  const theme = THEMES.light;
  const buttonScale = useState(new Animated.Value(1))[0];
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(50))[0];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 1000,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      })
    ]).start();

    const unsub = onAuthStateChanged(getAuth(), (user) => {
      if (user) {
        setEmail(user.email.trim().toLowerCase());
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    const autoCleanupCompletedReminders = async () => {
      const allReminders = await getDocs(collection(db, 'reminders'));
      for (const docSnap of allReminders.docs) {
        const data = docSnap.data();
        if (data.taskId) {
          const taskSnap = await getDoc(doc(db, 'tasks', data.taskId));
          if (taskSnap.exists() && taskSnap.data().status === 'completed') {
            await addDoc(collection(db, 'reminderHistory'), {
              ...data,
              movedAt: Timestamp.now(),
              reason: '✅ Auto-cleaned: Task already completed',
            });
            await deleteDoc(doc(db, 'reminders', docSnap.id));
          }
        }
      }
    };

    autoCleanupCompletedReminders();
  }, []);

  useEffect(() => {
    if (!email) return;

    setLoading(true);

    const q = query(
      collection(db, 'reminders'),
      where('studentEmail', '==', email),
      where('notified', '==', false),
      where('deadline', '>', Timestamp.fromDate(new Date())),
      orderBy('deadline', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setReminders(data);
        setLoading(false);
      },
      (err) => {
        console.error('Snapshot error:', err);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [email]);

  const handleExpired = (expiredId) => {
    setReminders((prev) => prev.filter((r) => r.id !== expiredId));
  };

  const animateButton = () => {
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 200,
        easing: Easing.elastic(2),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const clearAllReminders = async () => {
    animateButton();
    try {
      const q = query(
        collection(db, 'reminders'),
        where('studentEmail', '==', email)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        setDialog({ visible: true, title: 'Info', message: 'No reminders to clear.' });
        return;
      }

      const batch = writeBatch(db);

      for (const docSnap of snap.docs) {
        const data = docSnap.data();
        const reminderRef = docSnap.ref;
        const historyRef = doc(db, 'reminderHistory', docSnap.id);
        batch.set(historyRef, {
          ...data,
          movedAt: Timestamp.now(),
          reason: '🗑️ Manually cleared by student',
        });
        batch.delete(reminderRef);
      }

      await batch.commit();

      setReminders([]);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
      setDialog({ visible: true, title: 'Success', message: 'All reminders cleared successfully! 🎉' });
    } catch (err) {
      console.error('Clear error:', err);
      setDialog({
        visible: true,
        title: 'Error',
        message: `❌ Failed to clear reminders.\n${err.message || err}`,
      });
    }
  };

  if (loading) {
    return (
      <LinearGradient colors={[theme.primary, theme.secondary]} style={styles.loadingContainer}>
        <Animatable.View 
          animation="pulse" 
          iterationCount="infinite"
          style={styles.loadingContent}
        >
          <View style={styles.loadingIconContainer}>
            <Ionicons name="notifications" size={60} color="#FFF" />
          </View>
          <ActivityIndicator size="large" color="#FFF" style={styles.loadingSpinner} />
          <Text style={styles.loadingText}>Loading Your Reminders</Text>
          <Text style={styles.loadingSubtext}>Getting your deadlines ready</Text>
        </Animatable.View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[theme.background, '#F1F5F9']} style={{ flex: 1 }}>
      <ScrollView 
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Enhanced Header */}
        <Animated.View
          style={[
            styles.headerContainer,
            { 
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <LinearGradient
            colors={[theme.primary, theme.secondary]}
            style={styles.headerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <View style={styles.headerBackground}>
              <View style={styles.headerOrb1} />
              <View style={styles.headerOrb2} />
            </View>
            <View style={styles.headerContent}>
              <View style={styles.headerRow}>
                <View style={styles.headerIconContainer}>
                  <Ionicons name="notifications-circle" size={32} color="#FFF" />
                </View>
                <Text style={styles.header}>Smart Reminders</Text>
              </View>
              <Text style={styles.subheader}>
                Stay on top of your deadlines and tasks
              </Text>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Stats Overview */}
        {reminders.length > 0 && (
          <Animatable.View
            animation="fadeInUp"
            duration={600}
            delay={200}
            style={styles.statsContainer}
          >
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <LinearGradient
                  colors={['rgba(99, 102, 241, 0.1)', 'rgba(139, 92, 246, 0.1)']}
                  style={styles.statIconContainer}
                >
                  <Ionicons name="list" size={20} color={theme.primary} />
                </LinearGradient>
                <Text style={styles.statCount}>{reminders.length}</Text>
                <Text style={styles.statLabel}>Active</Text>
              </View>
              
              <View style={styles.statItem}>
                <LinearGradient
                  colors={['rgba(239, 68, 68, 0.1)', 'rgba(220, 38, 38, 0.1)']}
                  style={styles.statIconContainer}
                >
                  <Ionicons name="alert-circle" size={20} color={theme.danger} />
                </LinearGradient>
                <Text style={styles.statCount}>
                  {reminders.filter(r => r.priority === 'high').length}
                </Text>
                <Text style={styles.statLabel}>High Priority</Text>
              </View>
              
              <View style={styles.statItem}>
                <LinearGradient
                  colors={['rgba(16, 185, 129, 0.1)', 'rgba(52, 211, 153, 0.1)']}
                  style={styles.statIconContainer}
                >
                  <Ionicons name="checkmark-circle" size={20} color={theme.success} />
                </LinearGradient>
                <Text style={styles.statCount}>
                  {reminders.filter(r => r.priority === 'low').length}
                </Text>
                <Text style={styles.statLabel}>Low Priority</Text>
              </View>
            </View>
          </Animatable.View>
        )}

        {reminders.length === 0 ? (
          <Animatable.View 
            animation="fadeIn"
            style={styles.emptyState}
          >
            <LinearGradient
              colors={['rgba(99, 102, 241, 0.1)', 'rgba(139, 92, 246, 0.1)']}
              style={styles.emptyIllustration}
            >
              <Ionicons name="checkmark-done-circle" size={80} color={theme.primary} />
            </LinearGradient>
            <Text style={styles.emptyTitle}>All Caught Up!</Text>
            <Text style={styles.emptySubtext}>
              No active reminders. You're doing great! 🎉
            </Text>
            <Text style={styles.emptySubtext}>
              New reminders will appear here automatically
            </Text>
          </Animatable.View>
        ) : (
          <>
            <View style={styles.remindersSection}>
              <View style={styles.sectionHeader}>
                <LinearGradient
                  colors={['rgba(99, 102, 241, 0.1)', 'rgba(139, 92, 246, 0.1)']}
                  style={styles.sectionIconContainer}
                >
                  <Ionicons name="time" size={24} color={theme.primary} />
                </LinearGradient>
                <Text style={styles.sectionTitle}>Active Reminders</Text>
                <View style={styles.remindersCount}>
                  <Text style={styles.remindersCountText}>{reminders.length}</Text>
                </View>
              </View>

              <FlatList
                data={reminders}
                renderItem={({ item, index }) => (
                  <ReminderItem 
                    reminder={item} 
                    onExpired={handleExpired}
                    index={index}
                  />
                )}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
              />

              <Animated.View style={[styles.clearButtonContainer, { transform: [{ scale: buttonScale }] }]}>
                <TouchableOpacity 
                  style={styles.clearBtn}
                  onPress={clearAllReminders}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={[theme.danger, '#DC2626']}
                    style={styles.clearBtnGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Ionicons name="trash" size={20} color="#FFF" />
                    <Text style={styles.clearBtnText}>Clear All Reminders</Text>
                    <Ionicons name="arrow-forward" size={16} color="#FFF" style={styles.clearBtnIcon} />
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </>
        )}

        {/* Enhanced Modal */}
        <Modal visible={dialog.visible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <Animatable.View 
              animation={dialog.title === 'Success' ? 'bounceIn' : 'fadeInUp'}
              style={styles.modalBox}
            >
              <LinearGradient
                colors={dialog.title === 'Success' ? ['#10B981', '#34D399'] : ['rgba(99, 102, 241, 0.1)', 'rgba(139, 92, 246, 0.1)']}
                style={styles.modalHeader}
              >
                <Ionicons 
                  name={dialog.title === 'Success' ? "checkmark-circle" : "alert-circle"} 
                  size={48} 
                  color="#FFF" 
                />
              </LinearGradient>
              <Text style={styles.modalTitle}>{dialog.title}</Text>
              <Text style={styles.modalMsg}>{dialog.message}</Text>
              <Pressable 
                onPress={() => setDialog({ ...dialog, visible: false })} 
                style={styles.modalBtn}
              >
                <LinearGradient
                  colors={[theme.primary, theme.secondary]}
                  style={styles.modalBtnGradient}
                >
                  <Text style={styles.modalBtnText}>Got it!</Text>
                </LinearGradient>
              </Pressable>
            </Animatable.View>
          </View>
        </Modal>

        {/* Confetti */}
        {showConfetti && (
          <ConfettiCannon
            count={300}
            origin={{ x: width / 2, y: 0 }}
            explosionSpeed={500}
            fallSpeed={3000}
            colors={[theme.primary, theme.secondary, theme.success, theme.tertiary]}
            fadeOut={true}
          />
        )}
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  /* Loading Styles */
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
    padding: 40,
  },
  loadingIconContainer: {
    marginBottom: 20,
  },
  loadingSpinner: {
    marginBottom: 20,
  },
  loadingText: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  loadingSubtext: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    textAlign: 'center',
  },

  /* Main Container */
  container: {
    paddingBottom: 40,
    paddingTop: 45
  },

  /* Enhanced Header */
  headerContainer: {
    marginBottom: 25,
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  headerGradient: {
    paddingVertical: 25,
    paddingHorizontal: 25,
    position: 'relative',
    overflow: 'hidden',
  },
  headerBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  headerOrb1: {
    position: 'absolute',
    top: -50,
    right: -20,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  headerOrb2: {
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  headerContent: {
    zIndex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  header: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
  },
  subheader: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },

  /* Stats Container */
  statsContainer: {
    marginHorizontal: 20,
    marginBottom: 25,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statCount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },

  /* Reminders Section */
  remindersSection: {
    marginHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
  },
  remindersCount: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  remindersCountText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
  },

  /* Enhanced Card */
  cardContainer: {
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  reminderIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  priorityText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  detailsContainer: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  detailText: {
    fontSize: 14,
    color: '#475569',
  },
  countdownContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  countdownContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  countdown: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  countdownIndicator: {
    height: 3,
    width: '100%',
  },

  /* Empty State */
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginHorizontal: 20,
  },
  emptyIllustration: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 4,
  },

  /* Clear Button */
  clearButtonContainer: {
    marginTop: 25,
  },
  clearBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  clearBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  clearBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    marginLeft: 10,
    fontSize: 16,
  },
  clearBtnIcon: {
    marginLeft: 10,
    opacity: 0.9,
  },

  /* Enhanced Modal */
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 25,
  },
  modalBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '85%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.3,
    shadowRadius: 25,
    elevation: 15,
  },
  modalHeader: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 20,
    color: '#1E293B',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  modalMsg: {
    fontSize: 16,
    marginVertical: 20,
    textAlign: 'center',
    color: '#64748B',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  modalBtn: {
    margin: 20,
    borderRadius: 14,
    overflow: 'hidden',
  },
  modalBtnGradient: {
    paddingVertical: 16,
    paddingHorizontal: 25,
    alignItems: 'center',
  },
  modalBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default AutomatedReminder;