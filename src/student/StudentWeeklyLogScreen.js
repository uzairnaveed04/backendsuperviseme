import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ActivityIndicator, FlatList, Modal, ScrollView,
  Animated, Easing, Dimensions
} from 'react-native';
import { getAuth } from 'firebase/auth';
import {
  collection, query, where, getDocs, getDoc,
  doc, addDoc, Timestamp, orderBy, limit,
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import * as Animatable from 'react-native-animatable';
import ConfettiCannon from 'react-native-confetti-cannon';

const { width, height } = Dimensions.get('window');

/* helper → Monday */
const getWeekStart = (d = new Date()) => {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const m = new Date(d.setDate(diff));
  m.setHours(0, 0, 0, 0);
  return m;
};

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

export default function StudentWeeklyLogScreen() {
  const auth = getAuth();
  const theme = THEMES.light;

  const [email, setEmail] = useState(null);
  const [supervisorEmail, setSupervisorEmail] = useState('');
  const [loadingSup, setLoadingSup] = useState(true);

  const [currentLog, setCurrentLog] = useState('');
  const [currentWeekDone, setCurrentWeekDone] = useState(false);
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const [modal, setModal] = useState({ visible: false, msg: '' });
  const [showConfetti, setShowConfetti] = useState(false);

  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(50))[0];
  const buttonScale = useState(new Animated.Value(1))[0];

  const weekStart = getWeekStart();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  /*── animations ──*/
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
  }, []);

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

  /*── auth ──*/
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(u => setEmail(u?.email ?? null));
    return unsub;
  }, []);

  /*── fetch supervisor ──*/
  useEffect(() => {
    const fetchSup = async () => {
      if (!email) return;
      setLoadingSup(true);

      try {
        const taskSnap = await getDocs(
          query(collection(db, 'tasks'), where('assignedTo', '==', email))
        );

        if (!taskSnap.empty) {
          const tasks = taskSnap.docs
            .map(d => d.data())
            .filter(t => t.createdBy)
            .sort((a, b) =>
              (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)
            );

          if (tasks.length) {
            const sup = tasks[0].createdBy.trim().toLowerCase();
            console.log('✅ Supervisor from task:', sup);
            setSupervisorEmail(sup);
            setLoadingSup(false);
            return;
          }
        }

        const stuSnap = await getDoc(doc(db, 'students', email));
        if (stuSnap.exists()) {
          const sup = (stuSnap.data().supervisorEmail || '').trim().toLowerCase();
          console.log('📄 Supervisor from profile:', sup);
          setSupervisorEmail(sup);
        } else {
          console.warn('⚠️ No student document found');
          setSupervisorEmail('');
        }
      } catch (err) {
        console.error('🔥 fetchSup error →', err);
      } finally {
        setLoadingSup(false);
      }
    };

    fetchSup();
  }, [email]);

  /*── load logs ──*/
  useEffect(() => {
    if (email) loadLogs();
  }, [email]);

  const loadLogs = async () => {
    setLoadingLogs(true);
    try {
      const q = query(collection(db, 'weeklyLogs'), where('studentEmail', '==', email));
      const s = await getDocs(q);
      const arr = s.docs.map(d => ({ id: d.id, ...d.data() }));
      
      const epoch = v => {
        if (!v) return 0;
        if (typeof v.toDate === 'function') {
          try { return v.toDate().getTime(); } catch (e) { return 0; }
        }
        if (v instanceof Date) return v.getTime();
        if (typeof v === 'number') return v;
        return 0;
      };

      arr.sort((a, b) => epoch(b.weekStart) - epoch(a.weekStart));
      setLogs(arr);
      setCurrentWeekDone(
        arr.some(l => epoch(l.weekStart) === weekStart.getTime())
      );
    } catch (e) {
      console.error('loadLogs →', e);
    }
    setLoadingLogs(false);
  };

  /*── submit ──*/
  const submitLog = async () => {
    if (!currentLog.trim()) return;
    animateButton();

    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        setModal({ visible: true, msg: '❌ Please login first!' });
        return;
      }

      const token = await user.getIdToken();

      const checkRes = await fetch("http://192.168.100.117:3000/api/supervision-status", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const checkData = await checkRes.json();
      console.log("Supervision check →", checkData);

      if (!checkData.success || !checkData.isSupervised) {
        setModal({ visible: true, msg: "❌ You must be supervised before submitting a weekly log" });
        return;
      }

      const response = await fetch("http://192.168.100.117:3000/api/weekly-log/submit", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          logContent: currentLog.trim(),
          supervisorEmail: supervisorEmail || "N/A",
          weekStart: weekStart.toISOString(),
        }),
      });

      const result = await response.json();
      console.log("Weekly log API result →", result);

      if (result.success) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
        setModal({ visible: true, msg: "✅ Weekly log submitted successfully!" });
        setCurrentLog("");
        loadLogs();
      } else {
        setModal({ visible: true, msg: `❌ ${result.error || "Failed to submit"}` });
      }

    } catch (e) {
      console.error("submit error →", e);
      setModal({ visible: true, msg: "❌ Unable to submit. Please try again." });
    }
  };

  /*── render log card ──*/
  const RenderLog = ({ item, index }) => {
    const st = item.weekStart.toDate();
    const en = new Date(st);
    en.setDate(st.getDate() + 6);
    
    const statusColors = {
      pending: { bg: '#FEF3C7', text: '#D97706', icon: 'time' },
      reviewed: { bg: '#DBEAFE', text: '#1D4ED8', icon: 'visibility' },
      approved: { bg: '#D1FAE5', text: '#065F46', icon: 'check-circle' }
    };

    const status = item.status?.toLowerCase() || 'pending';
    const statusConfig = statusColors[status] || statusColors.pending;

    return (
      <Animatable.View
        animation="fadeInRight"
        duration={600}
        delay={index * 100}
        style={styles.card}
      >
        <View style={styles.cardHeader}>
          <LinearGradient
            colors={['rgba(99, 102, 241, 0.1)', 'rgba(139, 92, 246, 0.1)']}
            style={styles.dateIconContainer}
          >
            <MaterialIcons name="date-range" size={20} color={theme.primary} />
          </LinearGradient>
          <View style={styles.dateContainer}>
            <Text style={styles.weekDate}>
              {st.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - 
              {en.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </Text>
            <Text style={styles.weekYear}>{st.getFullYear()}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
            <MaterialIcons name={statusConfig.icon} size={16} color={statusConfig.text} />
            <Text style={[styles.statusText, { color: statusConfig.text }]}>
              {item.status || 'Pending'}
            </Text>
          </View>
        </View>
        <Text style={styles.logContent}>{item.logContent}</Text>
        {item.feedback && (
          <View style={styles.feedbackContainer}>
            <View style={styles.feedbackHeader}>
              <MaterialIcons name="comment" size={16} color={theme.primary} />
              <Text style={styles.feedbackLabel}>Supervisor Feedback:</Text>
            </View>
            <Text style={styles.feedbackText}>{item.feedback}</Text>
          </View>
        )}
      </Animatable.View>
    );
  };

  /*── UI ──*/
  if (loadingLogs) {
    return (
      <LinearGradient colors={[theme.primary, theme.secondary]} style={styles.loaderContainer}>
        <Animatable.View 
          animation="pulse" 
          iterationCount="infinite"
          style={styles.loadingContent}
        >
          <View style={styles.loadingIconContainer}>
            <MaterialIcons name="description" size={60} color="#FFF" />
          </View>
          <ActivityIndicator size="large" color="#FFF" style={styles.loadingSpinner} />
          <Text style={styles.loadingText}>Loading Your Weekly Reports</Text>
          <Text style={styles.loadingSubtext}>Preparing your progress dashboard</Text>
        </Animatable.View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[theme.background, '#F1F5F9']} style={{ flex: 1 }}>
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.contentContainer}
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
                  <MaterialIcons name="assessment" size={32} color="#FFF" />
                </View>
                <Text style={styles.header}>Weekly Progress Report</Text>
              </View>
              <Text style={styles.subHeader}>
                {weekStart.toLocaleDateString()} – {weekEnd.toLocaleDateString()}
              </Text>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Supervisor Loading */}
        {loadingSup && (
          <Animatable.View animation="fadeIn" style={styles.loadingSupContainer}>
            <LinearGradient
              colors={['rgba(99, 102, 241, 0.1)', 'rgba(139, 92, 246, 0.1)']}
              style={styles.loadingSupGradient}
            >
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={styles.loadingSupText}>Fetching supervisor information...</Text>
            </LinearGradient>
          </Animatable.View>
        )}

        {/* Input Section */}
        <Animatable.View
          animation="fadeInUp"
          duration={600}
          delay={200}
          style={styles.inputSection}
        >
          <View style={styles.sectionHeader}>
            <LinearGradient
              colors={['rgba(99, 102, 241, 0.1)', 'rgba(139, 92, 246, 0.1)']}
              style={styles.sectionIconContainer}
            >
              <MaterialIcons name="edit" size={24} color={theme.primary} />
            </LinearGradient>
            <Text style={styles.sectionTitle}>This Week's Progress</Text>
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={currentLog}
              onChangeText={setCurrentLog}
              placeholder="Describe your work, achievements, and challenges this week..."
              placeholderTextColor={theme.muted}
              multiline
              textAlignVertical="top"
            />
            <View style={styles.inputBorder} />
          </View>

          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!currentLog.trim() || loadingSup) && styles.submitButtonDisabled
              ]}
              disabled={!currentLog.trim() || loadingSup}
              onPress={submitLog}
            >
              <LinearGradient
                colors={[theme.primary, theme.secondary]}
                style={styles.submitButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <MaterialIcons name="send" size={20} color="#fff" />
                <Text style={styles.submitButtonText}>Submit Weekly Report</Text>
                <Ionicons name="rocket" size={16} color="#FFF" style={styles.submitIcon} />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </Animatable.View>

        {/* Previous Reports Section */}
        <Animatable.View
          animation="fadeInUp"
          duration={600}
          delay={400}
          style={styles.reportsSection}
        >
          <View style={styles.sectionHeader}>
            <LinearGradient
              colors={['rgba(99, 102, 241, 0.1)', 'rgba(139, 92, 246, 0.1)']}
              style={styles.sectionIconContainer}
            >
              <MaterialIcons name="history" size={24} color={theme.primary} />
            </LinearGradient>
            <Text style={styles.sectionTitle}>Your Previous Reports</Text>
            <View style={styles.reportsCount}>
              <Text style={styles.reportsCountText}>{logs.length}</Text>
            </View>
          </View>
          
          {logs.length === 0 ? (
            <Animatable.View animation="fadeIn" style={styles.emptyContainer}>
              <LinearGradient
                colors={['rgba(99, 102, 241, 0.1)', 'rgba(139, 92, 246, 0.1)']}
                style={styles.emptyIllustration}
              >
                <MaterialIcons name="description" size={64} color={theme.primary} />
              </LinearGradient>
              <Text style={styles.emptyTitle}>No Reports Yet</Text>
              <Text style={styles.emptySubtext}>
                Start by submitting your first weekly progress report above
              </Text>
            </Animatable.View>
          ) : (
            <FlatList 
              data={logs} 
              keyExtractor={i => i.id} 
              renderItem={RenderLog}
              scrollEnabled={false}
              contentContainerStyle={styles.listContainer}
            />
          )}
        </Animatable.View>

        {/* Enhanced Modal */}
        <Modal transparent visible={modal.visible} animationType="fade">
          <View style={styles.modalOverlay}>
            <Animatable.View 
              animation={modal.msg.includes('✅') ? 'bounceIn' : 'fadeInUp'}
              style={styles.modalContainer}
            >
              <LinearGradient
                colors={modal.msg.includes('✅') ? ['#10B981', '#34D399'] : ['rgba(99, 102, 241, 0.1)', 'rgba(139, 92, 246, 0.1)']}
                style={styles.modalHeader}
              >
                <MaterialIcons 
                  name={modal.msg.includes('✅') ? 'check-circle' : 'info'} 
                  size={48} 
                  color="#FFF" 
                />
              </LinearGradient>
              <Text style={styles.modalText}>{modal.msg}</Text>
              <TouchableOpacity 
                onPress={() => setModal({ visible: false, msg: '' })}
                style={styles.modalButton}
              >
                <LinearGradient
                  colors={[theme.primary, theme.secondary]}
                  style={styles.modalButtonGradient}
                >
                  <Text style={styles.modalButtonText}>Got it!</Text>
                </LinearGradient>
              </TouchableOpacity>
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
}

const styles = StyleSheet.create({
  /* Loading Styles */
  loaderContainer: {
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
    flex: 1,
    paddingTop: 35
  },
  contentContainer: {
    paddingBottom: 40
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
  subHeader: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },

  /* Supervisor Loading */
  loadingSupContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  loadingSupGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
  },
  loadingSupText: {
    marginLeft: 12,
    color: '#6366F1',
    fontSize: 14,
    fontWeight: '500',
  },

  /* Input Section */
  inputSection: {
    marginHorizontal: 20,
    marginBottom: 25,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
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
  inputContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  input: {
    height: 180,
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 16,
    padding: 20,
    textAlignVertical: 'top',
    backgroundColor: '#FFFFFF',
    fontSize: 16,
    color: '#1E293B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  inputBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    pointerEvents: 'none',
  },
  submitButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 10,
    fontSize: 16,
  },
  submitIcon: {
    marginLeft: 10,
    opacity: 0.9,
  },

  /* Reports Section */
  reportsSection: {
    marginHorizontal: 20,
  },
  reportsCount: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  reportsCountText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
  },

  /* Enhanced Card */
  card: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
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
  dateIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  dateContainer: {
    flex: 1,
  },
  weekDate: {
    fontWeight: 'bold',
    color: '#1E293B',
    fontSize: 16,
  },
  weekYear: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontWeight: '600',
    fontSize: 12,
    marginLeft: 6,
  },
  logContent: {
    color: '#475569',
    lineHeight: 22,
    fontSize: 14,
  },
  feedbackContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#6366F1',
  },
  feedbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  feedbackLabel: {
    fontWeight: '600',
    color: '#1E293B',
    marginLeft: 8,
    fontSize: 14,
  },
  feedbackText: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 18,
  },

  /* Empty State */
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
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
    fontSize: 20,
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

  /* List Container */
  listContainer: {
    paddingBottom: 20,
  },

  /* Enhanced Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 25,
  },
  modalContainer: {
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
  modalText: {
    textAlign: 'center',
    fontSize: 16,
    padding: 30,
    color: '#1E293B',
    lineHeight: 24,
    fontWeight: '500',
  },
  modalButton: {
    margin: 20,
    borderRadius: 14,
    overflow: 'hidden',
  },
  modalButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 25,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});