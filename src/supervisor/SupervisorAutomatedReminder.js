import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Dimensions,
  StatusBar,
  Animated,
} from 'react-native';

import { getAuth } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  deleteDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';

const SupervisorAutomatedReminder = () => {
  const [email, setEmail] = useState('');
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedReminderId, setSelectedReminderId] = useState(null);
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    const user = getAuth().currentUser;
    if (user) {
      setEmail(user.email.trim().toLowerCase());
    }
  }, []);

  useEffect(() => {
    if (!email) return;

    const q = query(
      collection(db, 'reminders'),
      where('supervisorEmail', '==', email),
      orderBy('deadline', 'asc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (snapshot.empty) {
        setReminders([]);
        setLoading(false);
        return;
      }

      const data = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const reminder = { id: docSnap.id, ...docSnap.data() };

          let title = 'Unknown Task';
          let status = 'Unknown';
          if (reminder.taskId) {
            try {
              const taskRef = doc(db, 'tasks', reminder.taskId);
              const taskSnap = await getDoc(taskRef);
              if (taskSnap.exists()) {
                const taskData = taskSnap.data();
                title = taskData.title || 'Untitled';
                status = taskData.status || 'pending';
              }
            } catch (err) {
              console.warn('Task fetch error:', err);
            }
          }

          return {
            ...reminder,
            title,
            status,
          };
        })
      );

      setReminders(data);
      setLoading(false);
    });

    return unsubscribe;
  }, [email]);

  useEffect(() => {
    const interval = setInterval(() => {
      const updated = reminders.map((reminder) => {
        const deadline = reminder.deadline?.toDate?.();
        const now = new Date();
        const diff = deadline - now;

        if (!deadline || isNaN(diff)) {
          return { ...reminder, timeLeft: '⛔ Invalid Deadline' };
        }

        if (diff <= 0) {
          return { ...reminder, timeLeft: '⛔ Deadline Passed' };
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / (1000 * 60)) % 60);

        return {
          ...reminder,
          timeLeft: `${days}d ${hours}h ${minutes}m`,
        };
      });

      setReminders(updated);
    }, 1000);

    return () => clearInterval(interval);
  }, [reminders]);

  const markAsNotified = async (id) => {
    try {
      const ref = doc(db, 'reminders', id);
      await updateDoc(ref, { notified: true });
    } catch (err) {
      console.error('Failed to mark as notified:', err);
    }
  };

  const confirmDelete = (id) => {
    setSelectedReminderId(id);
    setShowModal(true);
  };

  const deleteReminder = async () => {
    if (!selectedReminderId) return;

    try {
      await deleteDoc(doc(db, 'reminders', selectedReminderId));
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setShowModal(false);
      setSelectedReminderId(null);
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed': return '#4CAF50';
      case 'in progress': return '#2196F3';
      case 'pending': return '#FF9800';
      default: return '#9E9E9E';
    }
  };

  const getTimeLeftColor = (timeLeft) => {
    if (timeLeft?.includes('⛔')) return '#F44336';
    if (timeLeft?.includes('d') && parseInt(timeLeft) < 3) return '#FF9800';
    return '#4CAF50';
  };

  const renderItem = ({ item, index }) => (
    <Animated.View 
      style={[
        styles.card,
        {
          opacity: fadeAnim,
          transform: [{
            translateY: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [50, 0],
            }),
          }],
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.titleContainer}>
          <Text style={styles.icon}>📌</Text>
          <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.detailRow}>
        <Text style={styles.icon}>👨‍🎓</Text>
        <Text style={styles.detailText}>Student: {item.studentEmail}</Text>
      </View>

      <View style={styles.detailRow}>
        <Text style={styles.icon}>📅</Text>
        <Text style={styles.detailText}>
          Deadline: {item.deadline.toDate().toLocaleDateString('en-US', { 
            weekday: 'short', 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
          })}
        </Text>
      </View>

      <View style={styles.detailRow}>
        <Text style={styles.icon}>⏰</Text>
        <Text style={[styles.timeLeft, { color: getTimeLeftColor(item.timeLeft) }]}>
          {item.timeLeft || 'Loading...'}
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        {!item.notified && (
          <TouchableOpacity 
            style={[styles.button, styles.notifyButton]} 
            onPress={() => markAsNotified(item.id)}
          >
            <Text style={styles.buttonIcon}>✅</Text>
            <Text style={styles.buttonText}>Mark as Notified</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={[styles.button, styles.deleteButton]} 
          onPress={() => confirmDelete(item.id)}
        >
          <Text style={styles.buttonIcon}>🗑️</Text>
          <Text style={styles.buttonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading reminders...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#FF9800" barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Task Reminders</Text>
        <Text style={styles.headerSubtitle}>Manage student deadlines</Text>
        
        <View style={styles.reminderCountContainer}>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{reminders.length}</Text>
          </View>
          <Text style={styles.reminderCount}>Total Reminders</Text>
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {reminders.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTitle}>No Reminders</Text>
            <Text style={styles.emptyText}>You don't have any reminders assigned yet.</Text>
          </View>
        ) : (
          <FlatList
            data={reminders}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>

      {/* Delete Confirmation Modal */}
      <Modal visible={showModal} transparent animationType="fade">
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <View style={styles.modalIcon}>
              <Text style={styles.warningIcon}>⚠️</Text>
            </View>
            <Text style={styles.modalTitle}>Delete Reminder</Text>
            <Text style={styles.modalText}>
              Are you sure you want to delete this reminder? This action cannot be undone.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                onPress={() => setShowModal(false)} 
                style={[styles.modalButton, styles.cancelButton]}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={deleteReminder} 
                style={[styles.modalButton, styles.confirmDeleteButton]}
              >
                <Text style={styles.confirmButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingTop: 25,
    paddingBottom: 30,
    paddingHorizontal: 20,
    backgroundColor: '#FF9800',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#E0E7FF',
    marginBottom: 20,
  },
  reminderCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 10,
  },
  countText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  reminderCount: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    marginTop: 20,
  },
  listContent: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderLeftWidth: 4,
    borderLeftColor: '#6366F1',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  icon: {
    fontSize: 16,
    marginRight: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#6B7280',
  },
  timeLeft: {
    fontSize: 14,
    fontWeight: '600',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 10,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  notifyButton: {
    backgroundColor: '#10B981',
  },
  deleteButton: {
    backgroundColor: '#EF4444',
  },
  buttonIcon: {
    fontSize: 14,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: width * 0.85,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalIcon: {
    marginBottom: 16,
  },
  warningIcon: {
    fontSize: 48,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 16,
  },
  confirmDeleteButton: {
    backgroundColor: '#EF4444',
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default SupervisorAutomatedReminder;