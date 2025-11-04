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
  ScrollView
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
  modern: {
    primary: '#6366F1',
    secondary: '#8B5CF6',
    tertiary: '#06B6D4',
    accent: '#EC4899',
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
    background: '#FFFFFF',
    card: '#FFFFFF',
    glass: 'rgba(255, 255, 255, 0.9)',
    text: '#1E293B',
    muted: '#64748B',
    border: '#E2E8F0',
    gradient1: ['#6366F1', '#8B5CF6'],
    gradient2: ['#00D4AA', '#00B894'],
    gradient3: ['#FF6B9C', '#FF4757'],
    gradient4: ['#667eea', '#764ba2'],
    gradient5: ['#f093fb', '#f5576c'],
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
  const progressAnim = useRef(new Animated.Value(0)).current;

  /* --------------------------- helpers & values -------------------------- */
  const auth = getAuth();
  const email = auth.currentUser?.email?.trim().toLowerCase() ?? null;
  const navigation = useNavigation();
  const theme = THEMES.modern;

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
    if (points >= 50) badges.push('⭐ Star Performer');
    if (streak >= 7) badges.push('🔥 Hot Streak');

    return {
      total,
      completed,
      points,
      percent: total ? Math.round((completed / total) * 100) : 0,
      badges,
    };
  }, [tasks]);

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

  useEffect(() => {
    if (taskCompleted) {
      const timer = setTimeout(() => setTaskCompleted(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [taskCompleted]);

  // Animate progress bar
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: rewards.percent,
      duration: 1500,
      easing: Easing.out(Easing.exp),
      useNativeDriver: false,
    }).start();
  }, [rewards.percent]);

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
      const q = query(
        collection(db, 'tasks'),
        where('assignedTo', '==', email)
      );
      const snap = await getDocs(q);

      const filteredTasks = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(task => !task.clearedByStudent);

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
      showDialog('🎉 Task completed successfully!');
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
      showDialog('🗑️ All tasks cleared!');
    } catch (e) {
      console.error('clearAllTasks:', e);
      showDialog('⚠️ Could not clear tasks.');
    }
  };

  /* ----------------------------- rendering ------------------------------ */
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Animatable.View 
          animation="pulse" 
          iterationCount="infinite"
          style={styles.loadingContent}
        >
          <LinearGradient
            colors={theme.gradient1}
            style={styles.loadingIcon}
          >
            <Ionicons name="checklist" size={60} color="#FFF" />
          </LinearGradient>
          <ActivityIndicator size="large" color={theme.primary} style={styles.loadingSpinner} />
          <Text style={styles.loadingText}>Loading Your Tasks</Text>
          <Text style={styles.loadingSubtext}>Getting everything ready for you</Text>
        </Animatable.View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Background Decorations */}
      <View style={styles.backgroundDecor}>
        <View style={[styles.decorCircle, styles.decorCircle1]} />
        <View style={[styles.decorCircle, styles.decorCircle2]} />
        <View style={[styles.decorCircle, styles.decorCircle3]} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ------------------------------ Modern Header ------------------------------ */}
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
            colors={theme.gradient1}
            style={styles.headerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.headerContent}>
              <View style={styles.headerMain}>
                <View style={styles.headerIconContainer}>
                  <Ionicons name="checklist" size={32} color="#FFF" />
                </View>
                <View style={styles.headerText}>
                  <Text style={styles.headerTitle}>Task Manager</Text>
                  <Text style={styles.headerSubtitle}>Stay organized and productive</Text>
                </View>
              </View>
              
              <View style={styles.headerStats}>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{tasks.length}</Text>
                  <Text style={styles.statLabel}>Total</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{rewards.completed}</Text>
                  <Text style={styles.statLabel}>Done</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{rewards.points}</Text>
                  <Text style={styles.statLabel}>Points</Text>
                </View>
              </View>
            </View>
          </LinearGradient>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('StudentWeeklyLogScreen')}
            >
              <View style={styles.actionButtonContent}>
                <Ionicons name="calendar" size={20} color={theme.primary} />
                <Text style={styles.actionButtonText}>Weekly Report</Text>
              </View>
            </TouchableOpacity>

            {tasks.length > 0 && (
              <TouchableOpacity
                style={[styles.actionButton, styles.clearButton]}
                onPress={() => setConfirmClearModal(true)}
              >
                <View style={styles.actionButtonContent}>
                  <Ionicons name="trash" size={20} color={theme.error} />
                  <Text style={[styles.actionButtonText, styles.clearButtonText]}>Clear All</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* ----------------------------- Progress Overview ----------------------------- */}
        <Animatable.View 
          animation="fadeInUp" 
          duration={800} 
          delay={200} 
          style={styles.progressCard}
        >
          <View style={styles.progressHeader}>
            <LinearGradient
              colors={theme.gradient2}
              style={styles.progressIcon}
            >
              <Ionicons name="trophy" size={24} color="#FFF" />
            </LinearGradient>
            <View>
              <Text style={styles.progressTitle}>Progress Overview</Text>
              <Text style={styles.progressSubtitle}>Your completion journey</Text>
            </View>
          </View>

          <View style={styles.progressContent}>
            {/* Progress Circle */}
            <View style={styles.progressCircleContainer}>
              <View style={styles.progressCircle}>
                <LinearGradient
                  colors={theme.gradient1}
                  style={[styles.progressFill, { height: `${rewards.percent}%` }]}
                />
                <View style={styles.progressCenter}>
                  <Text style={styles.progressPercent}>{rewards.percent}%</Text>
                </View>
              </View>
            </View>

            {/* Stats */}
            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <Ionicons name="checkmark-circle" size={24} color={theme.success} />
                <Text style={styles.statCardNumber}>{rewards.completed}</Text>
                <Text style={styles.statCardLabel}>Completed</Text>
              </View>
              
              <View style={styles.statCard}>
                <Ionicons name="star" size={24} color="#FFD700" />
                <Text style={styles.statCardNumber}>{rewards.points}</Text>
                <Text style={styles.statCardLabel}>Points</Text>
              </View>
              
              <View style={styles.statCard}>
                <Ionicons name="list" size={24} color={theme.primary} />
                <Text style={styles.statCardNumber}>{tasks.length}</Text>
                <Text style={styles.statCardLabel}>Remaining</Text>
              </View>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBar}>
              <Animated.View 
                style={[
                  styles.progressBarFill,
                  { 
                    width: progressAnim.interpolate({
                      inputRange: [0, 100],
                      outputRange: ['0%', '100%'],
                    }) 
                  }
                ]}
              />
            </View>
            <Text style={styles.progressBarText}>{rewards.percent}% Complete</Text>
          </View>

          {/* Badges */}
          {rewards.badges.length > 0 && (
            <View style={styles.badgesContainer}>
              <Text style={styles.badgesTitle}>🏆 Achievements</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.badgesList}>
                  {rewards.badges.map((badge, index) => (
                    <Animatable.View 
                      key={index} 
                      animation="bounceIn" 
                      delay={index * 200} 
                      style={styles.badge}
                    >
                      <LinearGradient
                        colors={theme.gradient4}
                        style={styles.badgeGradient}
                      >
                        <Text style={styles.badgeText}>{badge}</Text>
                      </LinearGradient>
                    </Animatable.View>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}
        </Animatable.View>

        {/* ------------------------------ Task List ------------------------------ */}
        {tasks.length === 0 ? (
          <Animatable.View animation="fadeIn" style={styles.emptyState}>
            <LinearGradient
              colors={['#F8FAFC', '#F1F5F9']}
              style={styles.emptyIllustration}
            >
              <Ionicons name="checkmark-done" size={80} color={theme.primary} />
            </LinearGradient>
            <Text style={styles.emptyTitle}>All Caught Up! 🎉</Text>
            <Text style={styles.emptySubtext}>No pending tasks. Great job!</Text>
            <Text style={styles.emptySubtext}>New tasks will appear here</Text>
          </Animatable.View>
        ) : (
          <View style={styles.tasksContainer}>
            <View style={styles.tasksHeader}>
              <LinearGradient
                colors={theme.gradient1}
                style={styles.tasksIcon}
              >
                <Ionicons name="list" size={24} color="#FFF" />
              </LinearGradient>
              <Text style={styles.tasksTitle}>Your Tasks ({tasks.length})</Text>
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
                    styles.taskCard,
                    item.status?.toLowerCase() === 'completed' && styles.taskCompleted,
                  ]}
                >
                  <View style={styles.taskContent}>
                    {/* Task Header */}
                    <View style={styles.taskHeader}>
                      <View style={styles.taskTitleContainer}>
                        <Text style={styles.taskTitle}>{item.title}</Text>
                        <View style={styles.pointsContainer}>
                          <Ionicons name="star" size={14} color="#FFD700" />
                          <Text style={styles.pointsText}>{item.points || 5}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Task Description */}
                    <Text style={styles.taskDescription}>{item.description}</Text>

                    {/* Task Footer */}
                    <View style={styles.taskFooter}>
                      <View style={styles.taskMeta}>
                        <View style={[
                          styles.statusBadge,
                          item.status?.toLowerCase() === 'completed' && styles.statusCompleted
                        ]}>
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
                        </View>

                        {item.deadline && (
                          <View style={styles.deadline}>
                            <Ionicons name="calendar" size={14} color={theme.muted} />
                            <Text style={styles.deadlineText}>
                              {item.deadline.toDate().toLocaleDateString()}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Complete Button */}
                      {item.status?.toLowerCase() !== 'completed' && (
                        <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                          <TouchableOpacity
                            style={styles.completeButton}
                            onPress={() => markAsDone(item.id)}
                          >
                            <LinearGradient
                              colors={theme.gradient1}
                              style={styles.completeButtonGradient}
                            >
                              <Ionicons name="checkmark" size={18} color="#FFF" />
                              <Text style={styles.completeButtonText}>Complete</Text>
                            </LinearGradient>
                          </TouchableOpacity>
                        </Animated.View>
                      )}
                    </View>
                  </View>
                </Animatable.View>
              )}
            />
          </View>
        )}
      </ScrollView>

      {/* ------------------------------ Modals ------------------------------ */}
      <Modal transparent visible={dialog.visible} animationType="fade">
        <View style={styles.modalOverlay}>
          <Animatable.View animation="bounceIn" style={styles.modal}>
            <LinearGradient
              colors={dialog.msg.includes('🎉') ? theme.gradient2 : theme.gradient1}
              style={styles.modalHeader}
            >
              <Ionicons 
                name={dialog.msg.includes('🎉') ? 'checkmark-circle' : 'information-circle'} 
                size={48} 
                color="#FFF" 
              />
            </LinearGradient>
            <View style={styles.modalBody}>
              <Text style={styles.modalTitle}>
                {dialog.msg.includes('🎉') ? 'Success!' : 'Notice'}
              </Text>
              <Text style={styles.modalText}>{dialog.msg}</Text>
            </View>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setDialog((p) => ({ ...p, visible: false }))}
            >
              <LinearGradient
                colors={theme.gradient1}
                style={styles.modalButtonGradient}
              >
                <Text style={styles.modalButtonText}>Got It</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animatable.View>
        </View>
      </Modal>

      <Modal transparent visible={confirmClearModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <Animatable.View animation="fadeInUp" style={styles.modal}>
            <View style={styles.confirmHeader}>
              <Ionicons name="warning" size={48} color={theme.error} />
              <Text style={styles.confirmTitle}>Clear All Tasks?</Text>
            </View>
            <Text style={styles.confirmText}>
              This will remove all tasks from your view. This action cannot be undone.
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setConfirmClearModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteConfirmButton}
                onPress={clearAllTasks}
              >
                <LinearGradient
                  colors={theme.gradient3}
                  style={styles.deleteButtonGradient}
                >
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
          count={200}
          origin={{ x: width / 2, y: 0 }}
          explosionSpeed={400}
          fallSpeed={3000}
          colors={[theme.primary, theme.secondary, theme.success, '#FFD700']}
        />
      )}

      {/* ---------------------------- Completion Badge ---------------------------- */}
      {taskCompleted && (
        <Animatable.View 
          animation="bounceIn" 
          style={styles.completionBadge}
        >
          <LinearGradient
            colors={theme.gradient2}
            style={styles.completionGradient}
          >
            <Ionicons name="trophy" size={50} color="#FFF" />
            <Text style={styles.completionText}>Task Completed!</Text>
          </LinearGradient>
        </Animatable.View>
      )}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Modern White Styles                          */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },

  // Background Decorations
  backgroundDecor: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  decorCircle: {
    position: 'absolute',
    borderRadius: 100,
    backgroundColor: 'rgba(99, 102, 241, 0.03)',
  },
  decorCircle1: {
    top: '10%',
    right: '5%',
    width: 150,
    height: 150,
  },
  decorCircle2: {
    bottom: '20%',
    left: '3%',
    width: 100,
    height: 100,
  },
  decorCircle3: {
    top: '40%',
    right: '15%',
    width: 80,
    height: 80,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingContent: {
    alignItems: 'center',
    padding: 40,
  },
  loadingIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  loadingSpinner: {
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  loadingSubtext: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
  },

  // Header
  headerContainer: {
    marginBottom: 25,
  },
  headerGradient: {
    borderRadius: 20,
    padding: 25,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  headerContent: {
    zIndex: 1,
  },
  headerMain: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
  },
  headerStats: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 15,
    padding: 15,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 15,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  clearButton: {
    backgroundColor: '#FEF2F2',
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    marginLeft: 8,
    fontWeight: '600',
    fontSize: 14,
    color: '#6366F1',
  },
  clearButtonText: {
    color: '#EF4444',
  },

  // Progress Card
  progressCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 25,
    marginBottom: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  progressIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  progressTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  progressSubtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  progressContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  progressCircleContainer: {
    alignItems: 'center',
  },
  progressCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  progressFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderBottomLeftRadius: 50,
    borderBottomRightRadius: 50,
  },
  progressCenter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressPercent: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  statsContainer: {
    flex: 1,
    marginLeft: 20,
    gap: 12,
  },
  statCard: {
    backgroundColor: '#F8FAFC',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  statCardNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    marginVertical: 4,
  },
  statCardLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  progressBarContainer: {
    marginBottom: 20,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: 8,
    backgroundColor: '#6366F1',
    borderRadius: 4,
  },
  progressBarText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  badgesContainer: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 20,
  },
  badgesTitle: {
    fontWeight: '700',
    marginBottom: 15,
    color: '#1E293B',
    fontSize: 16,
  },
  badgesList: {
    flexDirection: 'row',
    gap: 10,
  },
  badge: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  badgeGradient: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },

  // Tasks
  tasksContainer: {
    marginBottom: 20,
  },
  tasksHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  tasksIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  tasksTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  taskCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  taskCompleted: {
    backgroundColor: '#F0FDF9',
    borderColor: '#D1FAE5',
  },
  taskContent: {
    padding: 20,
  },
  taskHeader: {
    marginBottom: 12,
  },
  taskTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  taskTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    flex: 1,
    marginRight: 12,
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pointsText: {
    color: '#D97706',
    fontWeight: 'bold',
    fontSize: 12,
    marginLeft: 4,
  },
  taskDescription: {
    color: '#64748B',
    marginBottom: 16,
    lineHeight: 20,
    fontSize: 14,
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  statusCompleted: {
    backgroundColor: '#10B981',
  },
  statusText: {
    fontWeight: '600',
    fontSize: 12,
    color: '#6366F1',
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
  completeButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  completeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  completeButtonText: {
    color: '#FFF',
    fontWeight: '600',
    marginLeft: 6,
    fontSize: 14,
  },

  // Empty State
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
    marginBottom: 25,
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

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
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
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    padding: 25,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#64748B',
    lineHeight: 22,
  },
  modalButton: {
    margin: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalButtonGradient: {
    paddingVertical: 14,
    paddingHorizontal: 25,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  confirmHeader: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 12,
  },
  confirmText: {
    textAlign: 'center',
    fontSize: 15,
    color: '#64748B',
    lineHeight: 22,
    paddingHorizontal: 25,
    paddingBottom: 25,
  },
  confirmButtons: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#64748B',
    fontWeight: 'bold',
  },
  deleteConfirmButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  deleteButtonGradient: {
    padding: 14,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
  },

  // Completion Badge
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
    elevation: 10,
  },
  completionGradient: {
    padding: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  completionText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 12,
  },
});

export default TaskReward;