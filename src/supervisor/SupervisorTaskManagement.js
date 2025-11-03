import React, { useState, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, Modal,
  Pressable, FlatList, ActivityIndicator, Animated, ScrollView,
  Dimensions
} from 'react-native';
import { db, auth } from '../../firebaseConfig';
import {
  collection, addDoc, Timestamp, doc, updateDoc, onSnapshot,
  getDocs, query, where
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import * as Animatable from 'react-native-animatable';
import LinearGradient from 'react-native-linear-gradient';

const { width, height } = Dimensions.get('window');

// Ultra Premium Color Theme
const theme = {
  primary: '#FF6B35',
  primaryDark: '#E55A2B',
  primaryLight: '#FF8C5A',
  secondary: '#FFD166',
  accent: '#06D6A0',
  background: '#0F172A',
  card: '#1E293B',
  text: '#FFFFFF',
  muted: '#94A3B8',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  gradient: ['#FF6B35', '#FF8C5A'],
  secondaryGradient: ['#FFD166', '#FFB74D'],
  accentGradient: ['#06D6A0', '#00B894'],
  darkGradient: ['#1E293B', '#334155']
};

const SupervisorTaskManagement = () => {
  const navigation = useNavigation();
  const [title, setTitle] = useState('');
  const [description, setDesc] = useState('');
  const [points, setPoints] = useState('');
  const [deadline, setDeadline] = useState('');
  const [assignedTo, setAssign] = useState('');
  const [showPointsList, setShowPointsList] = useState(false);
  const [supEmail, setSupEmail] = useState(null);
  const [supData, setSupData] = useState({ totalPoints: 0, badges: [], notifications: [] });
  const [loadingSup, setLoadingSup] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loadingMon, setLoadingMon] = useState(true);
  const [dialog, setDialog] = useState({ visible: false, title: '', message: '' });
  const [showAllTasks, setShowAllTasks] = useState(false); // New state for view all
  const fadeAnim = useState(new Animated.Value(0))[0];

  // ALL YOUR ORIGINAL LOGIC REMAINS EXACTLY THE SAME
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setSupEmail(user.email.trim().toLowerCase());
      } else {
        setSupEmail(null);
        setSupData({ totalPoints: 0, badges: [], notifications: [] });
        setTasks([]);
        setLogs([]);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!supEmail) { setLoadingSup(false); return; }
    setLoadingSup(true);
    const ref = doc(db, 'supervisors', supEmail);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setSupData({
            totalPoints: d.totalPoints || 0,
            badges: d.badges || [],
            notifications: d.notifications || [],
          });
        }
        setLoadingSup(false);
      },
      (err) => {
        showDialog('Error', err.message);
        setLoadingSup(false);
      }
    );
    return () => unsub();
  }, [supEmail]);

  useEffect(() => {
    if (!supEmail) { setLoadingMon(false); return; }
    const fetchAll = async () => {
      setLoadingMon(true);
      try {
        const tq = query(collection(db, 'tasks'), where('createdBy', '==', supEmail.toLowerCase()));
        const tsnap = await getDocs(tq);
        const taskData = tsnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setTasks(taskData);

        const lq = query(collection(db, 'weeklyLogs'), where('supervisorEmail', '==', supEmail.toLowerCase()));
        const lsnap = await getDocs(lq);
        
        if (lsnap.docs.length === 0) {
          const lq2 = query(collection(db, 'weeklyLogs'), where('supervisorEmail', '==', supEmail));
          const lsnap2 = await getDocs(lq2);
          if (lsnap2.docs.length > 0) {
            setLogs(lsnap2.docs.map((d) => ({ id: d.id, ...d.data() })));
          } else {
            setLogs([]);
          }
        } else {
          setLogs(lsnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }
      } catch (error) {
        showDialog('Error', 'Failed to load tasks or weekly logs: ' + error.message);
        setLogs([]);
      } finally {
        setLoadingMon(false);
      }
    };
    fetchAll();
  }, [supEmail]);

  const showDialog = (title, message) => {
    setDialog({ visible: true, title, message });
  };

  const stats = (() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const onTime = tasks.filter((t) => {
      if (t.status !== 'completed') return false;
      const dl = t.deadline?.toDate?.();
      const done = t.updatedAt?.toDate?.();
      return dl && done && dl >= done;
    }).length;
    return { total, completed, onTimePct: total ? Math.round((onTime / total) * 100) : 0 };
  })();

  const handleAssign = async () => {
    if (!title.trim() || !description.trim() || !points.trim() || !deadline.trim() || !assignedTo.trim()) {
      showDialog('Missing Info', 'Please fill all fields');
      return;
    }

    if (!supEmail) {
      showDialog('Authentication Error', 'Please wait for authentication to complete');
      return;
    }

    const date = new Date(deadline);
    if (isNaN(date)) {
      showDialog('Invalid Date', 'Use YYYY-MM-DD');
      return;
    }

    try {
      const slug = 'task-' + title.toLowerCase().replace(/\s+/g, '-');

      const taskRef = await addDoc(collection(db, 'tasks'), {
        title: title.trim(),
        description: description.trim(),
        points: parseInt(points, 10),
        deadline: Timestamp.fromDate(date),
        assignedTo: assignedTo.trim().toLowerCase(),
        projectId: slug,
        status: 'To Do',
        initialStatus: 'To Do',
        createdAt: Timestamp.now(),
        createdBy: supEmail,
        visibleToStudent: true,
        visibleToSupervisor: true
      });

      await addDoc(collection(db, 'reminders'), {
        taskId: taskRef.id,
        projectId: slug,
        studentEmail: assignedTo.trim().toLowerCase(),
        supervisorEmail: supEmail,
        deadline: Timestamp.fromDate(date),
        createdAt: Timestamp.now(),
        notified: false,
      });

      showDialog('Success', 'Task and reminder assigned ✅');
      setTitle('');
      setDesc('');
      setPoints('');
      setDeadline('');
      setAssign('');
    } catch (err) {
      console.error('Error while assigning task/reminder:', err);
      showDialog('Error', 'Failed to assign task and reminder ❌');
    }
  };

  // Function to handle view all tasks
  const handleViewAllTasks = () => {
    setShowAllTasks(!showAllTasks);
  };

  // Get tasks to display based on showAllTasks state
  const getTasksToDisplay = () => {
    return showAllTasks ? tasks : tasks.slice(0, 3);
  };

  // Premium Stat Card Component
  const StatCard = ({ icon, label, value, color, delay }) => (
    <Animatable.View 
      animation="fadeInUp"
      duration={800}
      delay={delay}
      style={styles.statCard}
    >
      <LinearGradient
        colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
        style={styles.statGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={[styles.statIconContainer, { backgroundColor: color }]}>
          <FontAwesome5 name={icon} size={20} color="#FFFFFF" />
        </View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </LinearGradient>
    </Animatable.View>
  );

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Premium Header */}
        <Animatable.View animation="fadeInDown" duration={1000} style={styles.header}>
          <LinearGradient
            colors={theme.gradient}
            style={styles.headerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.headerTop}>
              <View style={styles.headerText}>
                <Text style={styles.headerTitle}>Task Manager</Text>
                <Text style={styles.headerSubtitle}>Supervisor Dashboard</Text>
              </View>
              <View style={styles.headerBadge}>
                <FontAwesome5 name="crown" size={16} color="#FFD700" />
              </View>
            </View>
            
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.kanbanButton}
                onPress={() => navigation.navigate('StudentKanbanBoard')}
              >
                <LinearGradient
                  colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.2)']}
                  style={styles.kanbanGradient}
                >
                  <MaterialIcons name="dashboard" size={18} color="white" />
                  <Text style={styles.kanbanButtonText}>Kanban Board</Text>
                </LinearGradient>
              </TouchableOpacity>
              
              <View style={styles.profileBadge}>
                <Ionicons name="person" size={16} color="white" />
                <Text style={styles.profileText}>Supervisor</Text>
              </View>
            </View>
          </LinearGradient>
        </Animatable.View>

        {/* Quick Stats Row */}
        <Animatable.View animation="fadeInUp" duration={800} delay={200} style={styles.statsRow}>
          <StatCard 
            icon="tasks" 
            label="Total Tasks" 
            value={stats.total} 
            color={theme.primary}
            delay={200}
          />
          <StatCard 
            icon="check-circle" 
            label="Completed" 
            value={stats.completed} 
            color={theme.accent}
            delay={300}
          />
          <StatCard 
            icon="clock" 
            label="On Time %" 
            value={`${stats.onTimePct}%`} 
            color={theme.secondary}
            delay={400}
          />
        </Animatable.View>

        {/* Supervisor Profile Card */}
        {loadingSup ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.loadingText}>Loading profile...</Text>
          </View>
        ) : (
          <Animatable.View animation="fadeInUp" duration={800} delay={500} style={styles.profileCard}>
            <LinearGradient
              colors={theme.darkGradient}
              style={styles.profileGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.profileHeader}>
                <View style={styles.profileAvatar}>
                  <Ionicons name="person-circle" size={40} color={theme.primary} />
                </View>
                <View style={styles.profileInfo}>
                  <Text style={styles.profileName}>Supervisor</Text>
                  <Text style={styles.profileEmail}>{supEmail}</Text>
                </View>
                <View style={styles.pointsBadge}>
                  <FontAwesome5 name="star" size={14} color="#FFD700" />
                  <Text style={styles.pointsText}>{supData.totalPoints}</Text>
                </View>
              </View>
              
              {supData.badges.length > 0 && (
                <View style={styles.badgesContainer}>
                  <Text style={styles.badgesLabel}>Badges Earned:</Text>
                  <View style={styles.badgesList}>
                    {supData.badges.slice(0, 3).map((badge, index) => (
                      <View key={index} style={styles.badgeItem}>
                        <FontAwesome5 name="medal" size={12} color={theme.secondary} />
                        <Text style={styles.badgeText}>{badge}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </LinearGradient>
          </Animatable.View>
        )}

        {/* Task Monitoring Section - WITH VIEW ALL FUNCTIONALITY */}
        <Animatable.View animation="fadeInUp" duration={800} delay={600} style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <FontAwesome5 name="list-alt" size={20} color={theme.primary} />
              <Text style={styles.sectionTitle}>Task Monitoring</Text>
            </View>
            {tasks.length > 3 && (
              <TouchableOpacity 
                style={styles.viewAllButton}
                onPress={handleViewAllTasks}
              >
                <Text style={styles.viewAllText}>
                  {showAllTasks ? 'Show Less' : `View All (${tasks.length})`}
                </Text>
                <Ionicons 
                  name={showAllTasks ? "chevron-up" : "chevron-forward"} 
                  size={16} 
                  color={theme.primary} 
                />
              </TouchableOpacity>
            )}
          </View>
          
          {loadingMon ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : tasks.length === 0 ? (
            <View style={styles.emptyState}>
              <FontAwesome5 name="list" size={48} color={theme.muted} />
              <Text style={styles.emptyText}>No tasks assigned yet</Text>
            </View>
          ) : (
            <FlatList
              data={getTasksToDisplay()}
              keyExtractor={i => i.id}
              scrollEnabled={false}
              renderItem={({ item, index }) => (
                <Animatable.View 
                  animation="fadeInRight"
                  duration={600}
                  delay={index * 100}
                  style={styles.taskCard}
                >
                  <LinearGradient
                    colors={theme.darkGradient}
                    style={styles.taskGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={styles.taskHeader}>
                      <View style={styles.taskInfo}>
                        <View style={styles.taskAssignee}>
                          <Ionicons name="person" size={14} color={theme.muted} />
                          <Text style={styles.taskAssigneeText}>{item.assignedTo}</Text>
                        </View>
                        <Text style={styles.taskTitle}>{item.title}</Text>
                      </View>
                      <View style={[
                        styles.taskStatus, 
                        item.status === 'completed' ? styles.statusCompleted : 
                        item.status === 'in progress' ? styles.statusInProgress : 
                        styles.statusTodo
                      ]}>
                        <Text style={styles.statusText}>{item.status}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.taskMeta}>
                      <View style={styles.metaItem}>
                        <Ionicons name="calendar" size={14} color={theme.muted} />
                        <Text style={styles.metaText}>
                          {item.deadline?.toDate?.().toLocaleDateString()}
                        </Text>
                      </View>
                      <View style={styles.metaItem}>
                        <FontAwesome5 name="star" size={12} color={theme.secondary} />
                        <Text style={styles.metaText}>{item.points} pts</Text>
                      </View>
                    </View>
                  </LinearGradient>
                </Animatable.View>
              )}
            />
          )}
        </Animatable.View>

        {/* Weekly Logs Section */}
        <Animatable.View animation="fadeInUp" duration={800} delay={700} style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <Ionicons name="document-text" size={20} color={theme.primary} />
              <Text style={styles.sectionTitle}>Recent Weekly Logs</Text>
            </View>
          </View>
          
          {loadingMon ? null : logs.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-text" size={48} color={theme.muted} />
              <Text style={styles.emptyText}>No logs yet</Text>
            </View>
          ) : (
            <FlatList
              data={[...logs].sort((a, b) => b.submittedAt.seconds - a.submittedAt.seconds).slice(0, 3)}
              keyExtractor={i => i.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <Animatable.View 
                  animation="fadeInRight"
                  duration={600}
                  style={styles.logCard}
                >
                  <LinearGradient
                    colors={theme.darkGradient}
                    style={styles.logGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={styles.logHeader}>
                      <Ionicons name="person" size={16} color={theme.muted} />
                      <Text style={styles.logStudent}>{item.studentEmail}</Text>
                    </View>
                    <Text style={styles.logWeek}>
                      {item.weekStart?.toDate?.().toDateString()} –{' '}
                      {new Date(item.weekStart?.toDate?.().getTime() + 6 * 86400000).toDateString()}
                    </Text>
                    <Text style={styles.logContent} numberOfLines={3}>{item.logContent}</Text>
                    <Text style={styles.logTimestamp}>
                      <Ionicons name="time" size={12} color={theme.muted} />{' '}
                      {item.submittedAt?.toDate?.().toLocaleString()}
                    </Text>
                  </LinearGradient>
                </Animatable.View>
              )}
            />
          )}
        </Animatable.View>

        {/* Assign Task Form - Premium Design */}
        <Animatable.View animation="fadeInUp" duration={800} delay={800} style={styles.formSection}>
          <LinearGradient
            colors={theme.darkGradient}
            style={styles.formGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.formHeader}>
              <View style={styles.formIcon}>
                <FontAwesome5 name="plus-circle" size={24} color={theme.primary} />
              </View>
              <Text style={styles.formTitle}>Create New Task</Text>
            </View>

            <View style={styles.formContent}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Task Title</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="create" size={20} color={theme.primary} style={styles.inputIcon} />
                  <TextInput 
                    placeholder="Enter task title..." 
                    value={title} 
                    onChangeText={setTitle} 
                    style={styles.input} 
                    placeholderTextColor={theme.muted}
                  />
                </View>
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="document-text" size={20} color={theme.primary} style={styles.inputIcon} />
                  <TextInput 
                    placeholder="Describe the task..." 
                    value={description} 
                    onChangeText={setDesc} 
                    style={[styles.input, styles.multilineInput]} 
                    multiline
                    placeholderTextColor={theme.muted}
                  />
                </View>
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Difficulty Level</Text>
                <TouchableOpacity 
                  style={styles.pointsSelector} 
                  onPress={() => setShowPointsList(!showPointsList)}
                >
                  <Ionicons name="pricetag" size={20} color={theme.primary} style={styles.selectorIcon} />
                  <Text style={styles.selectorText}>
                    {points ? `${points} Points` : 'Select difficulty level'}
                  </Text>
                  <Ionicons 
                    name={showPointsList ? "chevron-up" : "chevron-down"} 
                    size={20} 
                    color={theme.primary} 
                  />
                </TouchableOpacity>
                
                {showPointsList && (
                  <Animatable.View 
                    animation={showPointsList ? "fadeInDown" : "fadeOutUp"} 
                    duration={300}
                    style={styles.dropdownList}
                  >
                    {[{ v: '3', l: '🟢 Easy (3 Points)' }, { v: '5', l: '🟡 Normal (5 Points)' }, { v: '10', l: '🔴 Hard (10 Points)' }].map(o => (
                      <TouchableOpacity 
                        key={o.v} 
                        style={styles.optionItem}
                        onPress={() => { setPoints(o.v); setShowPointsList(false); }}
                      >
                        <Text style={styles.optionText}>{o.l}</Text>
                      </TouchableOpacity>
                    ))}
                  </Animatable.View>
                )}
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Deadline</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="calendar" size={20} color={theme.primary} style={styles.inputIcon} />
                  <TextInput 
                    placeholder="YYYY-MM-DD" 
                    value={deadline} 
                    onChangeText={setDeadline} 
                    style={styles.input} 
                    placeholderTextColor={theme.muted}
                  />
                </View>
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Assign To Student</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="person-add" size={20} color={theme.primary} style={styles.inputIcon} />
                  <TextInput 
                    placeholder="student@email.com" 
                    value={assignedTo} 
                    onChangeText={setAssign} 
                    style={styles.input} 
                    placeholderTextColor={theme.muted}
                    autoCapitalize="none"
                  />
                </View>
              </View>
              
              <TouchableOpacity 
                style={styles.submitButton} 
                onPress={handleAssign}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={theme.gradient}
                  style={styles.submitButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="send" size={20} color="white" />
                  <Text style={styles.submitButtonText}>Assign Task</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animatable.View>
      </ScrollView>

      {/* Premium Dialog Modal */}
      <Modal visible={dialog.visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Animatable.View 
            animation="bounceIn"
            duration={600}
            style={styles.modalContainer}
          >
            <LinearGradient
              colors={dialog.title === 'Error' ? ['#EF4444', '#DC2626'] : theme.accentGradient}
              style={styles.modalGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.modalIconContainer}>
                <Ionicons 
                  name={dialog.title === 'Error' ? "close-circle" : "checkmark-circle"} 
                  size={60} 
                  color="#FFFFFF"
                />
              </View>
              <Text style={styles.modalTitle}>{dialog.title}</Text>
              <Text style={styles.modalMessage}>{dialog.message}</Text>
              <TouchableOpacity 
                style={styles.modalButton}
                onPress={() => setDialog({ ...dialog, visible: false })}
              >
                <Text style={styles.modalButtonText}>Got It</Text>
              </TouchableOpacity>
            </LinearGradient>
          </Animatable.View>
        </View>
      </Modal>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContainer: {
    paddingBottom: 40,
  },
  
  // Premium Header
  header: {
    marginBottom: 20,
  },
  headerGradient: {
    padding: 25,
    paddingTop: 20,
    paddingBottom: 25,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
  },
  headerBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,215,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kanbanButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  kanbanGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
  },
  kanbanButtonText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 14,
  },
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  profileText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 6,
    fontSize: 14,
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    marginHorizontal: 5,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  statGradient: {
    padding: 15,
    alignItems: 'center',
  },
  statIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: theme.muted,
    textAlign: 'center',
  },

  // Profile Card
  profileCard: {
    marginHorizontal: 20,
    marginBottom: 25,
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  profileGradient: {
    padding: 25,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  profileAvatar: {
    marginRight: 15,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: theme.muted,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,215,0,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  pointsText: {
    color: theme.secondary,
    fontWeight: 'bold',
    marginLeft: 4,
    fontSize: 14,
  },
  badgesContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 15,
  },
  badgesLabel: {
    color: theme.muted,
    fontSize: 14,
    marginBottom: 8,
  },
  badgesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  badgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 5,
  },
  badgeText: {
    color: theme.text,
    fontSize: 12,
    marginLeft: 4,
  },

  // Section Styles
  section: {
    marginHorizontal: 20,
    marginBottom: 25,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
    marginLeft: 10,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAllText: {
    color: theme.primary,
    fontWeight: '600',
    marginRight: 4,
    fontSize: 14,
  },

  // Task Card Styles
  taskCard: {
    borderRadius: 15,
    overflow: 'hidden',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  taskGradient: {
    padding: 15,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  taskInfo: {
    flex: 1,
    marginRight: 10,
  },
  taskAssignee: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  taskAssigneeText: {
    marginLeft: 5,
    color: theme.muted,
    fontSize: 12,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text,
  },
  taskStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusTodo: {
    backgroundColor: '#374151',
  },
  statusInProgress: {
    backgroundColor: '#1E40AF',
  },
  statusCompleted: {
    backgroundColor: '#065F46',
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  taskMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    marginLeft: 5,
    color: theme.muted,
    fontSize: 12,
  },

  // Log Card Styles
  logCard: {
    borderRadius: 15,
    overflow: 'hidden',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  logGradient: {
    padding: 15,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  logStudent: {
    marginLeft: 5,
    color: theme.muted,
    fontSize: 14,
  },
  logWeek: {
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 10,
  },
  logContent: {
    color: theme.muted,
    marginBottom: 10,
    lineHeight: 20,
  },
  logTimestamp: {
    color: theme.muted,
    fontSize: 12,
  },

  // Form Styles
  formSection: {
    marginHorizontal: 20,
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  formGradient: {
    padding: 25,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  formIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,107,53,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
  },
  formContent: {
    // Form content styles
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 50,
    color: theme.text,
    fontSize: 16,
  },
  multilineInput: {
    height: 100,
    textAlignVertical: 'top',
    paddingVertical: 15,
  },
  pointsSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  selectorIcon: {
    marginRight: 12,
  },
  selectorText: {
    flex: 1,
    color: theme.text,
    fontSize: 16,
  },
  dropdownList: {
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginTop: 5,
    overflow: 'hidden',
  },
  optionItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  optionText: {
    color: theme.text,
  },
  submitButton: {
    borderRadius: 15,
    overflow: 'hidden',
    marginTop: 10,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 8,
  },
  submitButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 15,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },

  // Empty State & Loading
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: theme.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  emptyText: {
    color: theme.muted,
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
  loadingCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: theme.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  loadingText: {
    color: theme.muted,
    marginTop: 12,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalContainer: {
    borderRadius: 25,
    overflow: 'hidden',
    width: '80%',
    maxWidth: 350,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 25,
    elevation: 15,
  },
  modalGradient: {
    padding: 30,
    alignItems: 'center',
  },
  modalIconContainer: {
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 25,
    color: '#FFFFFF',
    lineHeight: 24,
  },
  modalButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    padding: 15,
    minWidth: '50%',
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default SupervisorTaskManagement;