import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Dimensions,
  Modal,
  StatusBar
} from "react-native";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";

// ✅ CLI compatible imports
import Ionicons from "react-native-vector-icons/Ionicons";  
import LinearGradient from "react-native-linear-gradient";

const { width, height } = Dimensions.get('window');

// --- Color Scheme Definition ---
const colors = {
  primary: '#6366F1',
  primaryDark: '#4F46E5',
  primaryLight: '#8B5CF6',
  secondary: '#EC4899',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  light: '#F8FAFC',
  dark: '#1E293B',
  muted: '#64748B',
  background: '#FFFFFF', // White background
  card: '#FFFFFF',
  gradientStart: '#6366F1',
  gradientEnd: '#8B5CF6',
};

// --- Helper Functions ---
const getAvatarColor = (name) => {
  const avatarColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
  const index = name.length % avatarColors.length;
  return avatarColors[index];
};

const getInitials = (name) => {
  if (!name) return 'NN';
  return name.split(' ').map(n => n[0]).join('').toUpperCase();
};

// ===============================================
// ✅ 1. RequestItem Component
// ===============================================

const RequestItem = React.memo(({ item, index, colors, unreadCounts, setSelectedRequest, setShowActionModal, handleChatPress }) => {
  const isApproved = item.status === "Approved";
  const isPending = item.status === "Pending";
  const isRejected = item.status === "Rejected";
  const unreadCount = unreadCounts[item.senderId] || 0;

  const cardAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(cardAnim, {
      toValue: 1,
      tension: 50,
      friction: 7,
      delay: index * 150,
      useNativeDriver: true,
    }).start();
  }, [index, cardAnim]);

  const scale = cardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1]
  });

  const opacity = cardAnim;

  const statusColors = {
    Approved: colors.success,
    Rejected: colors.danger,
    Pending: colors.warning
  };

  const statusIcons = {
    Approved: "checkmark-circle",
    Rejected: "close-circle",
    Pending: "time"
  };

  return (
    <Animated.View
      style={[
        styles.requestCard,
        {
          opacity,
          transform: [{ scale }],
          borderLeftWidth: 6,
          borderLeftColor: statusColors[item.status],
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <LinearGradient
          colors={[getAvatarColor(item.studentName), getAvatarColor(item.studentName + '1')]}
          style={styles.avatar}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.avatarText}>{getInitials(item.studentName)}</Text>
        </LinearGradient>
        <View style={styles.studentInfo}>
          <Text style={styles.studentName}>{item.studentName}</Text>
          <Text style={styles.studentEmail}>{item.senderId}</Text>
        </View>
        {unreadCount > 0 && isApproved && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
          </View>
        )}
      </View>

      <View style={styles.messageContainer}>
        <Ionicons name="chatbubble-outline" size={16} color={colors.muted} style={styles.messageIcon} />
        <Text style={styles.messageText}>{item.message}</Text>
      </View>

      <View style={styles.statusContainer}>
        <View style={[styles.statusBadge, { backgroundColor: statusColors[item.status] + '20' }]}>
          <Ionicons name={statusIcons[item.status]} size={14} color={statusColors[item.status]} />
          <Text style={[styles.statusText, { color: statusColors[item.status] }]}>
            {item.status}
          </Text>
        </View>
        <Text style={styles.timeText}>Just now</Text>
      </View>

      {isPending && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            onPress={() => {
              setSelectedRequest(item);
              setShowActionModal(true);
            }}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[colors.success, '#34D399']}
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="checkmark" size={18} color="white" />
              <Text style={styles.actionButtonText}>Accept</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => {
              setSelectedRequest(item);
              setShowActionModal(true);
            }}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[colors.danger, '#F87171']}
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="close" size={18} color="white" />
              <Text style={styles.actionButtonText}>Reject</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {isApproved && (
        <TouchableOpacity
          style={styles.chatButton}
          onPress={() => handleChatPress(item.senderId)}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[colors.primary, colors.primaryLight]}
            style={styles.buttonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="chatbubbles" size={18} color="white" />
            <Text style={styles.actionButtonText}>Chat Now</Text>
            {unreadCount > 0 && (
              <View style={styles.floatingUnreadBadge}>
                <Text style={styles.floatingUnreadText}>{unreadCount}</Text>
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>
      )}

      {isRejected && (
        <View style={[styles.actionButton, styles.rejectedButton]}>
          <Ionicons name="close-circle" size={18} color={colors.danger} />
          <Text style={[styles.actionButtonText, { color: colors.danger }]}>Request Rejected</Text>
        </View>
      )}
    </Animated.View>
  );
});

// ===============================================
// ✅ 2. ChatItem Component
// ===============================================

const ChatItem = React.memo(({ item, index, colors, unreadCounts, handleChatPress }) => {
  const unreadCount = unreadCounts[item.senderId] || 0;
  const isApproved = item.status === "Approved";

  if (!isApproved) return null;

  const cardAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(cardAnim, {
      toValue: 1,
      tension: 50,
      friction: 7,
      delay: index * 100,
      useNativeDriver: true,
    }).start();
  }, [index, cardAnim]);

  const scale = cardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1]
  });

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={styles.chatCard}
        onPress={() => handleChatPress(item.senderId)}
        activeOpacity={0.7}
      >
        <View style={styles.chatContent}>
          <View style={styles.chatHeader}>
            <LinearGradient
              colors={[getAvatarColor(item.studentName), getAvatarColor(item.studentName + '1')]}
              style={styles.chatAvatar}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.chatAvatarText}>{getInitials(item.studentName)}</Text>
            </LinearGradient>
            <View style={styles.chatInfo}>
              <View style={styles.chatNameRow}>
                <Text style={styles.chatName}>{item.studentName}</Text>
                <Text style={styles.chatTime}>2m ago</Text>
              </View>
              <Text style={styles.chatPreview} numberOfLines={1}>
                {item.message.length > 50 ? item.message.substring(0, 50) + '...' : item.message}
              </Text>
            </View>
            {unreadCount > 0 && (
              <View style={styles.chatUnreadBadge}>
                <Text style={styles.chatUnreadText}>{unreadCount}</Text>
              </View>
            )}
          </View>
          <View style={styles.chatIndicator}>
            <View style={[styles.chatStatus, { backgroundColor: colors.success }]} />
            <Text style={styles.chatStatusText}>Online</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ===============================================
// 3. Main Component
// ===============================================

const Communication = ({ navigation }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [supervisorEmail, setSupervisorEmail] = useState("");
  const [unreadCounts, setUnreadCounts] = useState({});
  const [activeTab, setActiveTab] = useState('requests');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const unsubscribeRefs = useRef({});
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  const setupListeners = async (email) => {
    const q = query(collection(db, "messages"), where("receiverId", "==", email));
    const unsubscribeRequests = onSnapshot(q, async (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        studentName: doc.data().senderId ? doc.data().senderId.split('@')[0].replace(/[._]/g, ' ') : 'Unknown Student',
      }));
      setRequests(msgs);
      setLoading(false);

      msgs.forEach((msg) => {
        if (msg.status === "Approved") {
          setupUnreadListener(msg.senderId, email);
        }
      });
    });

    unsubscribeRefs.current.requests = unsubscribeRequests;
  };

  const setupUnreadListener = (studentId, supervisorEmail) => {
    if (unsubscribeRefs.current[studentId]) {
      unsubscribeRefs.current[studentId]();
    }

    const chatId = `${studentId}_${supervisorEmail}`;
    const msgRef = collection(db, "chats", chatId, "messages");
    const unreadQuery = query(
      msgRef,
      where("senderId", "==", studentId),
      where("read", "==", false)
    );

    const unsubscribe = onSnapshot(unreadQuery, (snap) => {
      setUnreadCounts((prev) => ({
        ...prev,
        [studentId]: snap.size,
      }));
    });

    unsubscribeRefs.current[studentId] = unsubscribe;
  };

  const showAlert = (title, message, color) => {
    Alert.alert(
      title,
      message,
      [{ text: "OK", style: "cancel" }],
      { userInterfaceStyle: 'light' }
    );
  };

  const handleAcceptRequest = async (requestId, senderId) => {
    try {
      const requestRef = doc(db, "messages", requestId);
      await updateDoc(requestRef, {
        status: "Approved",
      });
      setupUnreadListener(senderId, supervisorEmail);
      setShowActionModal(false);
      showAlert("Request Approved", "The student request has been approved successfully", colors.success);
    } catch (error) {
      showAlert("Error", "Failed to approve request", colors.danger);
      console.error("Error approving request:", error);
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      const requestRef = doc(db, "messages", requestId);
      await updateDoc(requestRef, {
        status: "Rejected",
      });
      setShowActionModal(false);
      showAlert("Request Rejected", "The student request has been rejected", colors.danger);
    } catch (error) {
      showAlert("Error", "Failed to reject request", colors.danger);
      console.error("Error rejecting request:", error);
    }
  };

  const handleChatPress = async (studentId) => {
    const chatId = `${studentId}_${supervisorEmail}`;
    const unreadQuery = query(
      collection(db, "chats", chatId, "messages"),
      where("senderId", "==", studentId),
      where("read", "==", false)
    );

    const snapshot = await getDocs(unreadQuery);
    if (!snapshot.empty) {
      snapshot.forEach(async (doc) => {
        const msgRef = doc.ref;
        await updateDoc(msgRef, {
          read: true,
        });
      });
      setUnreadCounts((prev) => ({
        ...prev,
        [studentId]: 0,
      }));
    }

    navigation.navigate("SChatScreen", {
      studentId,
      supervisorId: supervisorEmail,
    });
  };

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      })
    ]).start();

    const auth = getAuth();
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setSupervisorEmail(user.email);
        setupListeners(user.email);
      } else {
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      Object.values(unsubscribeRefs.current).forEach((unsub) => {
        if (unsub && typeof unsub === "function") unsub();
      });
    };
  }, [fadeAnim, slideAnim]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <StatusBar backgroundColor={colors.primaryDark} barStyle="light-content" />
      
      {/* Header */}
      <LinearGradient
        colors={['#FF9800', '#FF9800']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerIconContainer}>
            <Ionicons name="chatbubble-ellipses" size={28} color="white" />
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Supervisor Communication</Text>
            <Text style={styles.headerSubtitle}>Manage student requests & chats</Text>
          </View>
          <View style={styles.headerStats}>
            <Text style={styles.headerStat}>
              {requests.filter(r => r.status === 'Pending').length} Pending
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Tab selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'requests' && styles.activeTab
          ]}
          onPress={() => setActiveTab('requests')}
        >
          <Ionicons 
            name="list" 
            size={20} 
            color={activeTab === 'requests' ? colors.primary : colors.muted} 
          />
          <Text style={[
            styles.tabText,
            activeTab === 'requests' && styles.activeTabText
          ]}>
            Requests
          </Text>
          {requests.filter(r => r.status === 'Pending').length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>
                {requests.filter(r => r.status === 'Pending').length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'chats' && styles.activeTab
          ]}
          onPress={() => setActiveTab('chats')}
        >
          <Ionicons 
            name="chatbubbles" 
            size={20} 
            color={activeTab === 'chats' ? colors.primary : colors.muted} 
          />
          <Text style={[
            styles.tabText,
            activeTab === 'chats' && styles.activeTabText
          ]}>
            Active Chats
          </Text>
          {requests.filter(r => r.status === 'Approved' && unreadCounts[r.senderId] > 0).length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>
                {requests.filter(r => r.status === 'Approved' && unreadCounts[r.senderId] > 0).length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading communications...</Text>
        </View>
      ) : (
        <>
          {activeTab === 'requests' ? (
            <FlatList
              data={requests}
              keyExtractor={(item) => item.id}
              renderItem={({ item, index }) => (
                <RequestItem
                  item={item}
                  index={index}
                  colors={colors}
                  unreadCounts={unreadCounts}
                  setSelectedRequest={setSelectedRequest}
                  setShowActionModal={setShowActionModal}
                  handleChatPress={handleChatPress}
                />
              )}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="mail-open-outline" size={80} color={colors.muted} />
                  <Text style={styles.emptyText}>No requests received yet</Text>
                  <Text style={styles.emptySubtext}>Student requests will appear here</Text>
                </View>
              }
              contentContainerStyle={styles.listContent}
            />
          ) : (
            <FlatList
              data={requests.filter(r => r.status === 'Approved')}
              keyExtractor={(item) => item.id}
              renderItem={({ item, index }) => (
                <ChatItem
                  item={item}
                  index={index}
                  colors={colors}
                  unreadCounts={unreadCounts}
                  handleChatPress={handleChatPress}
                />
              )}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="chatbubbles-outline" size={80} color={colors.muted} />
                  <Text style={styles.emptyText}>No active chats yet</Text>
                  <Text style={styles.emptySubtext}>Approve student requests to start chatting</Text>
                </View>
              }
              contentContainerStyle={styles.listContent}
            />
          )}
        </>
      )}

      {/* Action Confirmation Modal */}
      <Modal visible={showActionModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalContainer, { transform: [{ scale: fadeAnim }] }]}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Ionicons name="help-circle" size={32} color={colors.primary} />
                <Text style={styles.modalTitle}>Confirm Action</Text>
              </View>
              
              <Text style={styles.modalText}>
                Are you sure you want to process this request from {selectedRequest?.studentName || 'this student'}?
              </Text>
              
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalReject]}
                  onPress={() => {
                    if (selectedRequest) {
                      handleRejectRequest(selectedRequest.id);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={[colors.danger, '#F87171']}
                    style={styles.modalButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Ionicons name="close" size={20} color="white" />
                    <Text style={styles.modalButtonText}>Reject</Text>
                  </LinearGradient>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalAccept]}
                  onPress={() => {
                    if (selectedRequest) {
                      handleAcceptRequest(selectedRequest.id, selectedRequest.senderId);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={[colors.success, '#34D399']}
                    style={styles.modalButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Ionicons name="checkmark" size={20} color="white" />
                    <Text style={styles.modalButtonText}>Accept</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowActionModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </Animated.View>
  );
};

// ===============================================
// 4. Stylesheet - WHITE BACKGROUND VERSION
// ===============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF', // Pure white background
  },
  header: {
    paddingTop: 25,
    paddingBottom: 40,
    paddingHorizontal: 30,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 15,
     backgroundColor: '#FF9800',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: 'white',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  headerStats: {
    alignItems: 'flex-end',
    backgroundColor: '#ff1100ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  headerStat: {
    fontSize: 12,
    color: 'white',
    fontWeight: '700',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 30,
    marginVertical: 25,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    marginHorizontal: 4,
  },
  activeTab: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748B',
    marginLeft: 10,
    letterSpacing: 0.5,
  },
  activeTabText: {
    color: '#6366F1',
  },
  tabBadge: {
    backgroundColor: '#EC4899',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
    minWidth: 24,
    alignItems: 'center',
    shadowColor: '#EC4899',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  tabBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '800',
  },
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    marginHorizontal: 30,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  avatarText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 18,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  studentEmail: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    backgroundColor: '#F8FAFC',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  messageIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  messageText: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
    flex: 1,
    fontWeight: '500',
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  timeText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
  },
  actionButton: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 18,
  },
  acceptButton: {
    flex: 1,
  },
  rejectButton: {
    flex: 1,
  },
  rejectedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 18,
    backgroundColor: '#FEF2F2',
    gap: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  chatButton: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
    marginLeft: 10,
    letterSpacing: 0.5,
  },
  unreadBadge: {
    backgroundColor: '#EC4899',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EC4899',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  unreadBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '800',
  },
  floatingUnreadBadge: {
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  floatingUnreadText: {
    color: '#EC4899',
    fontSize: 11,
    fontWeight: '800',
  },
  chatCard: {
    marginHorizontal: 30,
    marginBottom: 16,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  chatContent: {
    padding: 24,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  chatAvatar: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  chatAvatarText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 20,
  },
  chatInfo: {
    flex: 1,
  },
  chatNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  chatName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: 0.3,
  },
  chatTime: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  chatPreview: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    fontWeight: '500',
  },
  chatUnreadBadge: {
    backgroundColor: '#EC4899',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    shadowColor: '#EC4899',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  chatUnreadText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '800',
  },
  chatIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  chatStatus: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  chatStatusText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#64748B',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 70,
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    marginHorizontal: 30,
    marginTop: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  emptyText: {
    marginTop: 24,
    fontSize: 20,
    color: '#475569',
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  emptySubtext: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 22,
    fontWeight: '500',
  },
  listContent: {
    paddingBottom: 40,
    paddingTop: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  modalContainer: {
    width: width * 0.9,
    borderRadius: 30,
    overflow: 'hidden',
    elevation: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
  },
  modalContent: {
    padding: 35,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1E293B',
    marginLeft: 12,
    letterSpacing: 0.5,
  },
  modalText: {
    fontSize: 16,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    gap: 15,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 5,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  modalButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 18,
  },
  modalButtonText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 16,
    marginLeft: 10,
    letterSpacing: 0.5,
  },
  modalCancel: {
    padding: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  modalCancelText: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '700',
    letterSpacing: 0.3,
  }
});

export default Communication;