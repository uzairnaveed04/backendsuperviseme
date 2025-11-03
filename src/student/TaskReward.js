import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Animated,
  Easing,
  Dimensions,
  ScrollView,
  Image
} from 'react-native';
import { getAuth } from 'firebase/auth';
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useNavigation } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as Animatable from 'react-native-animatable';
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
    error: '#EF4444',
    warning: '#F59E0B',
    muted: '#94A3B8',
    gradientStart: '#6366F1',
    gradientEnd: '#8B5CF6'
  },
};

const TaskReward = () => {
  /* ----------------------------- state & refs ----------------------------- */
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState({ visible: false, msg: '' });
  const [confirmClearModal, setConfirmClearModal] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [taskCompleted, setTaskCompleted] = useState(false);

  const buttonScale = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  /* --------------------------- helpers & values -------------------------- */
  const auth = getAuth();
  const email = auth.currentUser?.email?.trim().toLowerCase() ?? null;
  const navigation = useNavigation();
  const theme = THEMES.light;

  /* ------------------------------ lifecycle ------------------------------ */
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

    if (email) loadTasks();
  }, [email]);

  // auto‑hide the in‑app "Task Completed" badge
  useEffect(() => {
    if (taskCompleted) {
      const timer = setTimeout(() => setTaskCompleted(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [taskCompleted]);

  /* ------------------------- animation utilities ------------------------ */
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

  /* --------------------------- ui helpers -------------------------------- */
  const showDialog = (msg) => setDialog({ visible: true, msg });

  /* --------------------------- firestore calls --------------------------- */
  const loadTasks = async () => {
    setLoading(true);
    try {
      console.log('🔍 Loading tasks for email:', email);

      const q = query(
        collection(db, 'tasks'),
        where('assignedTo', '==', email)
      );
      const snap = await getDocs(q);

      console.log('📋 Total tasks found:', snap.docs.length);

      snap.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`Task ${index + 1}:`, {
          id: doc.id,
          title: data.title,
          assignedTo: data.assignedTo,
          status: data.status,
          clearedByStudent: data.clearedByStudent
        });
      });

      const filteredTasks = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(task => !task.clearedByStudent);

      console.log('✅ Filtered tasks (not cleared):', filteredTasks.length);

      setTasks(filteredTasks);
    } catch (e) {
      console.error('❌ loadTasks error:', e);
      showDialog('⚠️ Could not load tasks.');
    } finally {
      setLoading(false);
    }
  };

  const markAsDone = async (taskId) => {
    animateButton();
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        status: 'completed',
        updatedAt: serverTimestamp(),
      });

      setTaskCompleted(true);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
      showDialog('✅ Task marked as completed!');
      loadTasks();
    } catch (error) {
      console.error('markAsDone:', error);
      showDialog('⚠️ Error marking task as done.');
    }
  };

  const clearAllTasks = async () => {
    setConfirmClearModal(false);
    try {
      const q = query(collection(db, 'tasks'), where('assignedTo', '==', email));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        showDialog('No tasks to clear.');
        return;
      }

      const batch = writeBatch(db);
      snap.docs.forEach((doc) => {
        batch.update(doc.ref, {
          clearedByStudent: true,
          clearedAt: serverTimestamp()
        });
      });

      await batch.commit();
      setTasks([]);
      showDialog('🗑️ Tasks cleared from your view!');
    } catch (e) {
      console.error('clearAllTasks:', e);
      showDialog('⚠️ Could not clear tasks.');
    }
  };

  /* --------------------------- derived values --------------------------- */
  const rewards = useMemo(() => {
    const total = tasks.length;
    let completed = 0,
      points = 0,
      onTime = 0,
      streak = 0;

    const today = new Date();

    tasks.forEach((t) => {
      if (t.status?.toLowerCase() === 'completed') {
        completed += 1;
        points += 5;

        const done = t.updatedAt?.toDate?.() || t.deadline?.toDate?.();
        if (done && (today - done) / 86400000 <= 7) streak += 1;
        if (t.deadline?.toDate && done && t.deadline.toDate() >= done) onTime += 1;
      }
    });

    if (streak >= 7) points += 10;

    const badges = [];
    if (onTime >= 5) badges.push('🎯 Sharp Shooter');
    if (completed >= 20) badges.push('🧠 Hard Worker');

    return {
      total,
      completed,
      points,
      percent: total ? Math.round((completed / total) * 100) : 0,
      badges,
    };
  }, [tasks]);

  /* ----------------------------- rendering ------------------------------ */
  if (loading) {
    return (
      <LinearGradient colors={[theme.primary, theme.secondary]} style={styles.loadingContainer}>
        <Animatable.View 
          animation="pulse" 
          iterationCount="infinite"
          style={styles.loadingContent}
        >
          <View style={styles.loadingIconContainer}>
            <Ionicons name="rocket" size={60} color="#FFF" />
          </View>
          <ActivityIndicator size="large" color="#FFF" style={styles.loadingSpinner} />
          <Text style={styles.loadingText}>Loading Your Tasks</Text>
          <Text style={styles.loadingSubtext}>Preparing your mission dashboard</Text>
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
        {/* ------------------------------ Enhanced Header ------------------------------ */}
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
                  <Ionicons name="list-circle" size={32} color="#FFF" />
                </View>
                <Text style={styles.header}>Task Mission</Text>
              </View>
              <Text style={styles.headerSubtitle}>Complete tasks and earn rewards</Text>
            </View>
          </LinearGradient>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('StudentWeeklyLogScreen')}
            >
              <LinearGradient
                colors={['rgba(99, 102, 241, 0.1)', 'rgba(139, 92, 246, 0.1)']}
                style={styles.actionButtonGradient}
              >
                <Ionicons name="calendar" size={20} color={theme.primary} />
                <Text style={styles.actionButtonText}>Weekly Report</Text>
              </LinearGradient>
            </TouchableOpacity>

            {tasks.length > 0 && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => setConfirmClearModal(true)}
              >
                <LinearGradient
                  colors={['rgba(239, 68, 68, 0.1)', 'rgba(220, 38, 38, 0.1)']}
                  style={styles.actionButtonGradient}
                >
                  <Ionicons name="trash" size={20} color={theme.error} />
                  <Text style={[styles.actionButtonText, { color: theme.error }]}>Clear All</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* ----------------------------- Enhanced Progress Box ----------------------------- */}
        <Animatable.View 
          animation="fadeInUp" 
          duration={600} 
          delay={200} 
          style={styles.rewardBox}
        >
          <View style={styles.sectionHeader}>
            <LinearGradient
              colors={['rgba(99, 102, 241, 0.1)', 'rgba(139, 92, 246, 0.1)']}
              style={styles.sectionIconContainer}
            >
              <Ionicons name="trophy" size={24} color={theme.primary} />
            </LinearGradient>
            <Text style={styles.section}>Your Progress Dashboard</Text>
          </View>

          <View style={styles.progressContainer}>
            {/* Completed Count */}
            <View style={styles.progressItem}>
              <LinearGradient
                colors={['rgba(99, 102, 241, 0.1)', 'rgba(139, 92, 246, 0.1)']}
                style={styles.progressIconContainer}
              >
                <Ionicons name="checkmark-circle" size={24} color={theme.primary} />
              </LinearGradient>
              <View style={styles.progressText}>
                <Text style={styles.progressCount}>{rewards.completed}</Text>
                <Text style={styles.progressLabel}>Completed</Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressBarItem}>
              <View style={styles.progressBarHeader}>
                <Text style={styles.progressBarLabel}>Progress</Text>
                <Text style={styles.percentText}>{rewards.percent}%</Text>
              </View>
              <View style={styles.bar}>
                <Animated.View
                  style={[
                    styles.fill,
                    {
                      width: `${rewards.percent}%`,
                      backgroundColor:
                        rewards.percent >= 80
                          ? theme.success
                          : rewards.percent >= 50
                          ? '#F59E0B'
                          : theme.primary,
                    },
                  ]}
                />
              </View>
            </View>

            {/* Points */}
            <View style={styles.progressItem}>
              <LinearGradient
                colors={['rgba(99, 102, 241, 0.1)', 'rgba(139, 92, 246, 0.1)']}
                style={styles.progressIconContainer}
              >
                <Ionicons name="star" size={24} color={theme.primary} />
              </LinearGradient>
              <View style={styles.progressText}>
                <Text style={styles.progressCount}>{rewards.points}</Text>
                <Text style={styles.progressLabel}>Points</Text>
              </View>
            </View>
          </View>

          {/* Badges */}
          {rewards.badges.length > 0 && (
            <View style={styles.badgesContainer}>
              <Text style={styles.badgesTitle}>🏆 Your Achievements</Text>
              <View style={styles.badgesList}>
                {rewards.badges.map((badge, index) => (
                  <Animatable.View 
                    key={index} 
                    animation="bounceIn" 
                    delay={index * 200} 
                    style={styles.badge}
                  >
                    <LinearGradient
                      colors={['rgba(99, 102, 241, 0.1)', 'rgba(139, 92, 246, 0.1)']}
                      style={styles.badgeGradient}
                    >
                      <Text style={styles.badgeText}>{badge}</Text>
                    </LinearGradient>
                  </Animatable.View>
                ))}
              </View>
            </View>
          )}
        </Animatable.View>

        {/* ------------------------------ Enhanced Task List ------------------------------ */}
        {tasks.length === 0 ? (
          <Animatable.View animation="fadeIn" style={styles.emptyState}>
            <LinearGradient
              colors={['rgba(99, 102, 241, 0.1)', 'rgba(139, 92, 246, 0.1)']}
              style={styles.emptyIllustration}
            >
              <Ionicons name="checkmark-done-circle" size={80} color={theme.primary} />
            </LinearGradient>
            <Text style={styles.emptyTitle}>Mission Accomplished!</Text>
            <Text style={styles.emptySubtext}>No pending tasks. You're all caught up!</Text>
            <Text style={styles.emptySubtext}>Check back later for new missions</Text>
          </Animatable.View>
        ) : (
          <View style={styles.tasksContainer}>
            <View style={styles.tasksHeader}>
              <LinearGradient
                colors={['rgba(99, 102, 241, 0.1)', 'rgba(139, 92, 246, 0.1)']}
                style={styles.tasksIconContainer}
              >
                <Ionicons name="list" size={24} color={theme.primary} />
              </LinearGradient>
              <Text style={styles.tasksTitle}>Your Missions ({tasks.length})</Text>
            </View>
            
            <FlatList
              data={tasks}
              keyExtractor={(i) => i.id}
              scrollEnabled={false}
              renderItem={({ item, index }) => (
                <Animatable.View
                  animation="fadeInRight"
                  duration={600}
                  delay={index * 100}
                  style={[
                    styles.card,
                    item.status?.toLowerCase() === 'completed' && styles.done,
                  ]}
                >
                  {/* Header Row */}
                  <View style={styles.cardHeader}>
                    <View style={styles.titleContainer}>
                      <Text style={styles.title}>{item.title}</Text>
                      <View style={styles.pointsBadge}>
                        <Ionicons name="flash" size={14} color="#FFF" />
                        <Text style={styles.pointsText}>{item.points || 5} pts</Text>
                      </View>
                    </View>
                  </View>

                  {/* Description */}
                  <Text style={styles.description}>{item.description}</Text>

                  {/* Status & Deadline */}
                  <View style={styles.statusContainer}>
                    <LinearGradient
                      colors={
                        item.status?.toLowerCase() === 'completed' 
                          ? ['#10B981', '#34D399'] 
                          : ['rgba(99, 102, 241, 0.1)', 'rgba(139, 92, 246, 0.1)']
                      }
                      style={styles.statusBadge}
                    >
                      <Ionicons 
                        name={item.status?.toLowerCase() === 'completed' ? 'checkmark' : 'time'} 
                        size={14} 
                        color={item.status?.toLowerCase() === 'completed' ? '#FFF' : theme.primary} 
                      />
                      <Text style={[
                        styles.statusText,
                        item.status?.toLowerCase() === 'completed' && styles.statusTextCompleted
                      ]}>
                        {item.status || 'Pending'}
                      </Text>
                    </LinearGradient>

                    {item.deadline && (
                      <View style={styles.deadline}>
                        <Ionicons name="calendar" size={16} color={theme.muted} />
                        <Text style={styles.deadlineText}>
                          {item.deadline.toDate().toLocaleDateString()}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Mark as Done Button */}
                  {item.status?.toLowerCase() !== 'completed' && (
                    <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                      <TouchableOpacity
                        style={styles.markBtn}
                        onPress={() => markAsDone(item.id)}
                        activeOpacity={0.8}
                      >
                        <LinearGradient
                          colors={[theme.primary, theme.secondary]}
                          style={styles.markBtnGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                        >
                          <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                          <Text style={styles.btnTxt}>Complete Mission</Text>
                          <Ionicons name="rocket" size={16} color="#FFF" style={styles.btnIcon} />
                        </LinearGradient>
                      </TouchableOpacity>
                    </Animated.View>
                  )}
                </Animatable.View>
              )}
            />
          </View>
        )}

        {/* ------------------------------ Enhanced Dialog Modal ------------------------------ */}
        <Modal
          transparent
          visible={dialog.visible}
          animationType="fade"
          onRequestClose={() => setDialog((p) => ({ ...p, visible: false }))}
        >
          <View style={styles.overlay}>
            <Animatable.View
              animation={dialog.msg.includes('✅') ? 'bounceIn' : 'fadeInUp'}
              style={styles.modal}
            >
              <LinearGradient
                colors={dialog.msg.includes('✅') ? ['#10B981', '#34D399'] : ['rgba(99, 102, 241, 0.1)', 'rgba(139, 92, 246, 0.1)']}
                style={styles.modalHeader}
              >
                <Ionicons 
                  name={dialog.msg.includes('✅') ? 'checkmark-circle' : 'information-circle'} 
                  size={48} 
                  color="#FFF" 
                />
              </LinearGradient>
              <Text style={styles.modalText}>{dialog.msg}</Text>
              <TouchableOpacity
                style={styles.okButton}
                onPress={() => setDialog((p) => ({ ...p, visible: false }))}
              >
                <LinearGradient
                  colors={[theme.primary, theme.secondary]}
                  style={styles.okButtonGradient}
                >
                  <Text style={styles.okButtonText}>Awesome!</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animatable.View>
          </View>
        </Modal>

        {/* ------------------------ Enhanced Confirm Clear Modal ------------------------ */}
        <Modal
          transparent
          visible={confirmClearModal}
          animationType="fade"
          onRequestClose={() => setConfirmClearModal(false)}
        >
          <View style={styles.overlay}>
            <Animatable.View animation="fadeInUp" style={styles.confirmModal}>
              <LinearGradient
                colors={['rgba(239, 68, 68, 0.1)', 'rgba(220, 38, 38, 0.1)']}
                style={styles.confirmHeader}
              >
                <Ionicons name="warning" size={48} color={theme.error} />
                <Text style={styles.confirmTitle}>Confirm Clear</Text>
              </LinearGradient>

              <Text style={styles.confirmText}>
                Are you sure you want to clear all tasks from your view?
              </Text>

              <View style={styles.confirmButtons}>
                <TouchableOpacity
                  style={[styles.confirmButton, styles.cancelButton]}
                  onPress={() => setConfirmClearModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.confirmButton, styles.deleteButton]}
                  onPress={clearAllTasks}
                >
                  <LinearGradient
                    colors={[theme.error, '#DC2626']}
                    style={styles.deleteButtonGradient}
                  >
                    <Ionicons name="trash" size={18} color="#FFF" />
                    <Text style={styles.deleteButtonText}>Clear All</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </Animatable.View>
          </View>
        </Modal>

        {/* ------------------------------ Confetti ------------------------------ */}
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

        {/* ---------------------------- Enhanced Completion Badge ---------------------------- */}
        {taskCompleted && (
          <Animatable.View 
            animation="bounceIn" 
            style={styles.completionBadge}
          >
            <LinearGradient
              colors={['#FFD700', '#FFED4E']}
              style={styles.completionGradient}
            >
              <Animatable.View 
                animation="pulse" 
                iterationCount={3}
                style={styles.completionIcon}
              >
                <Ionicons name="trophy" size={60} color="#FFF" />
              </Animatable.View>
              <Text style={styles.completionText}>Mission Complete!</Text>
              <Text style={styles.completionSubtext}>Great work! Keep it up!</Text>
            </LinearGradient>
          </Animatable.View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Enhanced Styles                              */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  /* Loading Container */
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
    padding: 20,
    paddingBottom: 40,
    paddingTop: 50
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
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },

  /* Action Buttons */
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  actionButtonText: {
    marginLeft: 8,
    fontWeight: '600',
    fontSize: 14,
  },

  /* Enhanced Reward Box */
  rewardBox: {
    backgroundColor: '#FFF',
    padding: 25,
    borderRadius: 20,
    marginBottom: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 8,
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
  section: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  progressItem: {
    alignItems: 'center',
    flex: 1,
  },
  progressIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressText: {
    alignItems: 'center',
  },
  progressCount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6366F1',
  },
  progressLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  progressBarItem: {
    flex: 2,
    marginHorizontal: 15,
  },
  progressBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressBarLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  bar: {
    height: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    overflow: 'hidden',
  },
  fill: {
    height: 12,
    borderRadius: 6,
  },
  percentText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6366F1',
  },
  badgesContainer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  badgesTitle: {
    fontWeight: '700',
    marginBottom: 12,
    color: '#1E293B',
    fontSize: 16,
  },
  badgesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  badgeGradient: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  badgeText: {
    color: '#6366F1',
    fontSize: 12,
    fontWeight: '600',
  },

  /* Tasks Container */
  tasksContainer: {
    marginBottom: 20,
  },
  tasksHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  tasksIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tasksTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },

  /* Enhanced Task Card */
  card: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  done: {
    backgroundColor: '#F0FDF9',
  },
  cardHeader: {
    marginBottom: 12,
  },
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    flex: 1,
    marginRight: 12,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366F1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pointsText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
    marginLeft: 4,
  },
  description: {
    color: '#64748B',
    marginBottom: 16,
    lineHeight: 22,
    fontSize: 14,
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  statusText: {
    fontWeight: 'bold',
    fontSize: 12,
    marginLeft: 6,
  },
  statusTextCompleted: {
    color: '#FFF',
  },
  deadline: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deadlineText: {
    marginLeft: 6,
    fontSize: 12,
    color: '#64748B',
  },
  markBtn: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  markBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
  },
  btnTxt: {
    color: '#FFF',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 16,
  },
  btnIcon: {
    marginLeft: 8,
  },

  /* Empty State */
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 20,
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
  },

  /* Enhanced Dialog Modal */
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 25,
  },
  modal: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    width: '85%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    padding: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalText: {
    textAlign: 'center',
    fontSize: 16,
    padding: 25,
    color: '#1E293B',
    lineHeight: 22,
  },
  okButton: {
    margin: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  okButtonGradient: {
    paddingVertical: 14,
    paddingHorizontal: 25,
    alignItems: 'center',
  },
  okButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },

  /* Enhanced Confirm Modal */
  confirmModal: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    width: '85%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  confirmHeader: {
    padding: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 12,
    color: '#1E293B',
  },
  confirmText: {
    textAlign: 'center',
    fontSize: 15,
    padding: 25,
    color: '#64748B',
    lineHeight: 22,
  },
  confirmButtons: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  confirmButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cancelButton: {
    backgroundColor: '#F1F5F9',
  },
  cancelButtonText: {
    color: '#64748B',
    fontWeight: 'bold',
    padding: 14,
    textAlign: 'center',
  },
  deleteButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  deleteButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
  },
  deleteButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    marginLeft: 8,
  },

  /* Enhanced Completion Badge */
  completionBadge: {
    position: 'absolute',
    top: '35%',
    alignSelf: 'center',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  completionGradient: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  completionIcon: {
    marginBottom: 15,
  },
  completionText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
  },
  completionSubtext: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
});

export default TaskReward;