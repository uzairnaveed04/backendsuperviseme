import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  Dimensions,
  ScrollView,
  StatusBar,
  Alert
} from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  updateDoc,
  doc,
  onSnapshot,
  orderBy,
  where,
  getDocs,
  deleteDoc,
  limit
} from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as Animatable from 'react-native-animatable';
import { ProjectContext } from './ProjectContext'; 
import LinearGradient from 'react-native-linear-gradient';

const { width, height } = Dimensions.get('window');

const SupervisorProjectTracking = () => {
  const { assignedRequests } = useContext(ProjectContext); 
  
  const [requests, setRequests] = useState([]);
  const [supervisorEmail, setSupervisorEmail] = useState(null);
  const [dialog, setDialog] = useState({ visible: false, title: '', message: '' });
  const [statusModal, setStatusModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [status, setStatus] = useState('');
  const [comment, setComment] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [loading, setLoading] = useState(false);
  const [deletedRequests, setDeletedRequests] = useState([]);
  const [assigning, setAssigning] = useState(false);
  const [activeTab, setActiveTab] = useState('requests');
  
  // Premium Animations
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(50))[0];
  const headerScale = useState(new Animated.Value(0.8))[0];
  const cardScale = useState(new Animated.Value(0.9))[0];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 1000,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
      Animated.spring(headerScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.spring(cardScale, {
        toValue: 1,
        tension: 60,
        friction: 8,
        delay: 300,
        useNativeDriver: true,
      })
    ]).start();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setSupervisorEmail(user.email.trim().toLowerCase());
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!supervisorEmail) return;

    const q = query(
      collection(db, 'projectRequests'),
      where('supervisorEmail', '==', supervisorEmail),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setRequests(data);
      },
      (error) => {
        if (error.code === 'failed-precondition') {
          setDialog({
            visible: true,
            title: '⚠️ Firestore Index Required',
            message: 'Please create composite index for: supervisorEmail + createdAt'
          });
        }
      }
    );

    return unsubscribe;
  }, [supervisorEmail]);

  const showMessage = (title, message) => {
    setDialog({ visible: true, title, message });
  };

  const updateRequestStatus = async () => {
    if (!selectedRequest || !status) {
      showMessage('Error', 'Status is required');
      return;
    }

    try {
      await updateDoc(doc(db, 'projectRequests', selectedRequest.id), {
        status: status.trim().toLowerCase(),
        comment: comment.trim(),
        updatedAt: serverTimestamp()
      });
      
      setRequests(prevRequests => 
        prevRequests.map(request => 
          request.id === selectedRequest.id 
            ? { ...request, status: status.trim().toLowerCase(), comment: comment.trim() }
            : request
        )
      );
      
      setStatusModal(false);
      showMessage('✅ Success', 'Status updated successfully');
    } catch (err) {
      showMessage('❌ Error', err.message);
    }
  };

  const assignProjectFromRequest = async (request) => {
    if (!request || request.status !== 'approved') {
      showMessage('Error', 'Only approved requests can be assigned.');
      return;
    }

    if (assignedRequests.includes(request.id)) {
      showMessage('Info', 'This project is already assigned.');
      return;
    }

    try {
      setAssigning(true);
      await addDoc(collection(db, 'projects'), {
        title: request.projectTitle,
        description: request.description,
        deadline: request.deadline || '',
        studentEmail: request.studentEmail,
        supervisorEmail: request.supervisorEmail,
        status: 'assigned',
        assignedFromRequest: true,
        requestId: request.id,
        createdAt: serverTimestamp()
      });
      
      showMessage('🎉 Success', 'Project assigned successfully!');
    } catch (err) {
      showMessage('❌ Error', err.message);
    } finally {
      setAssigning(false);
    }
  };

  const deleteProjectAssignedFromRequest = async (request) => {
    Alert.alert(
      "🗑️ Confirm Delete",
      "Are you sure you want to delete this project request? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              // Debug logs for supervisorEmail
              console.log('Auth supervisorEmail:', supervisorEmail);
              console.log('Request supervisorEmail:', request.supervisorEmail);
              // For each project, log supervisorEmail
              const q = query(
                collection(db, 'projects'),
                where('requestId', '==', request.id),
                where('assignedFromRequest', '==', true)
              );
              const snapshot = await getDocs(q);
              for (const docSnap of snapshot.docs) {
                const projectData = docSnap.data();
                console.log('Project supervisorEmail:', projectData.supervisorEmail);
                await updateDoc(doc(db, 'projects', docSnap.id), {
                  visibleToSupervisor: false,
                });
              }
              // Only hide the project for supervisor, don't delete projectRequests
              setDeletedRequests((prev) => [...prev, request.id]);
              setRequests((prev) => prev.filter((r) => r.id !== request.id));
              showMessage('✅ Success', 'Project hidden from supervisor view!');
            } catch (err) {
              let errorMsg = 'Unknown error';
              if (err && err.code) {
                errorMsg = `Code: ${err.code}\nMessage: ${err.message}`;
              } else if (err && err.message) {
                errorMsg = err.message;
              }
              showMessage('❌ Error', errorMsg);
              console.log('Firestore delete error:', err);
            }
          }
        }
      ]
    );
  };

  const manuallyCreateProject = async () => {
    if (!projectTitle || !description || !deadline || !studentEmail) {
      showMessage('Error', 'All fields are required');
      return;
    }

    const cleanEmail = studentEmail.trim().toLowerCase();
    if (!cleanEmail.endsWith('@cuiatk.edu.pk')) {
      showMessage('Error', 'Enter a valid student email');
      return;
    }

    try {
      setLoading(true);

      await addDoc(collection(db, 'projects'), {
        title: projectTitle.trim(),
        description: description.trim(),
        deadline: deadline.trim(),
        studentEmail: cleanEmail,
        supervisorEmail: supervisorEmail ? supervisorEmail.toLowerCase() : '', // Always set supervisorEmail
        status: 'available',
        visibleToSupervisor: true,
        isSupervisorCreated: true,
        createdAt: new Date(),
      });

      setProjectTitle('');
      setDescription('');
      setDeadline('');
      setStudentEmail('');
      showMessage('🚀 Success', 'Project created successfully!');
    } catch (err) {
      showMessage('❌ Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return '#00D4AA';
      case 'rejected': return '#FF6B9C';
      case 'pending': return '#FFB74D';
      default: return '#8B5CF6';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved': return 'checkmark-circle';
      case 'rejected': return 'close-circle';
      case 'pending': return 'time';
      default: return 'help-circle';
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate();
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const StatusBadge = ({ status }) => (
    <LinearGradient
      colors={[getStatusColor(status), `${getStatusColor(status)}CC`]}
      style={styles.statusBadge}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <Ionicons 
        name={getStatusIcon(status)} 
        size={14} 
        color="#FFF" 
      />
      <Text style={styles.statusText}>
        {status.toUpperCase()}
      </Text>
    </LinearGradient>
  );

  return (
    <Animated.View style={[styles.container, { 
      opacity: fadeAnim, 
      transform: [{ translateY: slideAnim }]
    }]}>
      <StatusBar barStyle="light-content" backgroundColor='#FF9800' />
      
      {/* 🔥 Ultra Premium Header */}
      <Animated.View style={{ transform: [{ scale: headerScale }] }}>
        <LinearGradient
          colors={['#FF9800', '#FF9800', '#FF9800']}
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Animated Background Elements */}
          <View style={styles.headerBg1} />
          <View style={styles.headerBg2} />
          <View style={styles.headerBg3} />
          
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <Animatable.View 
                animation="pulse" 
                iterationCount="infinite" 
                direction="alternate"
                style={styles.headerIconContainer}
              >
                <Ionicons name="rocket" size={32} color="#FFF" />
              </Animatable.View>
              <View style={styles.headerTextContainer}>
                <Text style={styles.headerTitle}>Project Tracking</Text>
                <Text style={styles.headerSubtitle}>Supervisor Dashboard</Text>
              </View>
            </View>
            
            <View style={styles.headerRight}>
              <LinearGradient
                colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
                style={styles.requestCount}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.requestCountText}>{requests.length}</Text>
                <Text style={styles.requestCountLabel}>Requests</Text>
              </LinearGradient>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* 💫 Premium Tab Navigation */}
      <Animated.View style={{ transform: [{ scale: cardScale }] }}>
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[
              styles.tab, 
              activeTab === 'requests' && styles.activeTab
            ]}
            onPress={() => setActiveTab('requests')}
          >
            <LinearGradient
              colors={activeTab === 'requests' ? 
                ['#8B5CF6', '#6366F1'] : 
                ['#F8FAFC', '#F1F5F9']
              }
              style={styles.tabGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons 
                name="document-text" 
                size={22} 
                color={activeTab === 'requests' ? '#FFF' : '#6366F1'} 
              />
              <Text style={[
                styles.tabText, 
                { color: activeTab === 'requests' ? '#FFF' : '#6366F1' }
              ]}>
                Requests
              </Text>
              {requests.length > 0 && (
                <View style={[
                  styles.tabBadge,
                  { backgroundColor: activeTab === 'requests' ? 'rgba(255,255,255,0.3)' : '#FF6B9C' }
                ]}>
                  <Text style={styles.tabBadgeText}>{requests.length}</Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.tab, 
              activeTab === 'create' && styles.activeTab
            ]}
            onPress={() => setActiveTab('create')}
          >
            <LinearGradient
              colors={activeTab === 'create' ? 
                ['#8B5CF6', '#6366F1'] : 
                ['#F8FAFC', '#F1F5F9']
              }
              style={styles.tabGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons 
                name="add-circle" 
                size={22} 
                color={activeTab === 'create' ? '#FFF' : '#6366F1'} 
              />
              <Text style={[
                styles.tabText, 
                { color: activeTab === 'create' ? '#FFF' : '#6366F1' }
              ]}>
                Create Project
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Animated.View>

      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'create' ? (
          /* 🎨 Premium Create Project Form */
          <Animatable.View 
            animation="fadeInUp"
            duration={800}
            style={styles.createSection}
          >
            <LinearGradient
              colors={['#FFFFFF', '#F8FAFC']}
              style={styles.sectionGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.sectionHeader}>
                <LinearGradient
                  colors={['#8B5CF6', '#6366F1']}
                  style={styles.sectionIcon}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="rocket" size={28} color="#FFF" />
                </LinearGradient>
                <View>
                  <Text style={styles.sectionTitle}>Create New Project</Text>
                  <Text style={styles.sectionSubtitle}>Assign project to student</Text>
                </View>
              </View>
              
              <View style={styles.form}>
                {/* Student Email Input */}
                <View style={styles.inputGroup}>
                  <View style={styles.inputLabelContainer}>
                    <Ionicons name="mail" size={18} color="#6366F1" />
                    <Text style={styles.inputLabel}>Student Email</Text>
                  </View>
                  <LinearGradient
                    colors={['#F8FAFC', '#FFFFFF']}
                    style={styles.inputContainer}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <TextInput
                      placeholder="student@cuiatk.edu.pk"
                      placeholderTextColor="#94A3B8"
                      value={studentEmail}
                      onChangeText={setStudentEmail}
                      style={styles.input}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                  </LinearGradient>
                </View>
                
                {/* Project Title Input */}
                <View style={styles.inputGroup}>
                  <View style={styles.inputLabelContainer}>
                    <Ionicons name="document" size={18} color="#6366F1" />
                    <Text style={styles.inputLabel}>Project Title</Text>
                  </View>
                  <LinearGradient
                    colors={['#F8FAFC', '#FFFFFF']}
                    style={styles.inputContainer}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <TextInput
                      placeholder="Enter project title"
                      placeholderTextColor="#94A3B8"
                      value={projectTitle}
                      onChangeText={setProjectTitle}
                      style={styles.input}
                    />
                  </LinearGradient>
                </View>
                
                {/* Description Input */}
                <View style={styles.inputGroup}>
                  <View style={styles.inputLabelContainer}>
                    <Ionicons name="document-text" size={18} color="#6366F1" />
                    <Text style={styles.inputLabel}>Description</Text>
                  </View>
                  <LinearGradient
                    colors={['#F8FAFC', '#FFFFFF']}
                    style={[styles.inputContainer, styles.textAreaContainer]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <TextInput
                      placeholder="Describe the project details..."
                      placeholderTextColor="#94A3B8"
                      value={description}
                      onChangeText={setDescription}
                      style={[styles.input, styles.textArea]}
                      multiline
                      textAlignVertical="top"
                    />
                  </LinearGradient>
                </View>
                
                {/* Deadline Input */}
                <View style={styles.inputGroup}>
                  <View style={styles.inputLabelContainer}>
                    <Ionicons name="calendar" size={18} color="#6366F1" />
                    <Text style={styles.inputLabel}>Deadline</Text>
                  </View>
                  <LinearGradient
                    colors={['#F8FAFC', '#FFFFFF']}
                    style={styles.inputContainer}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <TextInput
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#94A3B8"
                      value={deadline}
                      onChangeText={setDeadline}
                      style={styles.input}
                    />
                  </LinearGradient>
                </View>

                {/* Create Button */}
                <TouchableOpacity 
                  style={styles.createButton}
                  onPress={manuallyCreateProject}
                  disabled={loading}
                >
                  <LinearGradient
                    colors={['#8B5CF6', '#6366F1', '#4F46E5']}
                    style={styles.createButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    {loading ? (
                      <Animatable.View animation="rotate" iterationCount="infinite">
                        <Ionicons name="refresh" size={24} color="#FFF" />
                      </Animatable.View>
                    ) : (
                      <Ionicons name="add-circle" size={24} color="#FFF" />
                    )}
                    <Text style={styles.createButtonText}>
                      {loading ? 'Creating Project...' : 'Create & Assign Project'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </Animatable.View>
        ) : (
          /* 💎 Premium Requests List */
          <Animatable.View 
            animation="fadeInUp"
            duration={600}
            delay={200}
          >
            <LinearGradient
              colors={['#FFFFFF', '#F8FAFC']}
              style={styles.requestsSection}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.sectionHeader}>
                <LinearGradient
                  colors={['#8B5CF6', '#6366F1']}
                  style={styles.sectionIcon}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="notifications" size={28} color="#FFF" />
                </LinearGradient>
                <View>
                  <Text style={styles.sectionTitle}>Project Requests</Text>
                  <Text style={styles.sectionSubtitle}>Manage student requests</Text>
                </View>
              </View>
            </LinearGradient>

            {requests.length === 0 ? (
              <Animatable.View 
                animation="fadeIn"
                style={styles.emptyContainer}
              >
                <Ionicons name="folder-open" size={80} color="#8B5CF6" />
                <Text style={styles.emptyText}>No Project Requests</Text>
                <Text style={styles.emptySubtext}>Student requests will appear here</Text>
              </Animatable.View>
            ) : (
              <View style={styles.requestsList}>
                {requests.map((item, index) => (
                  <Animatable.View
                    key={item.id}
                    animation="fadeInRight"
                    duration={600}
                    delay={index * 100}
                    style={styles.card}
                  >
                    <LinearGradient
                      colors={['#FFFFFF', '#F8FAFC']}
                      style={styles.cardGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <View style={styles.cardHeader}>
                        <View style={styles.cardTitleContainer}>
                          <Text style={styles.cardTitle} numberOfLines={2}>
                            {item.projectTitle}
                          </Text>
                          <StatusBadge status={item.status} />
                        </View>
                      </View>
                      
                      <View style={styles.cardBody}>
                        <View style={styles.detailRow}>
                          <Ionicons name="person" size={18} color="#6366F1" />
                          <Text style={styles.detailText}>{item.studentEmail}</Text>
                        </View>
                        
                        <Text style={styles.description} numberOfLines={3}>
                          {item.description}
                        </Text>
                        
                        <View style={styles.detailRow}>
                          <Ionicons name="time" size={18} color="#6366F1" />
                          <Text style={styles.detailText}>{formatDate(item.createdAt)}</Text>
                        </View>

                        {item.comment && (
                          <View style={styles.commentContainer}>
                            <Text style={styles.commentLabel}>Your Comment:</Text>
                            <Text style={styles.commentText}>{item.comment}</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.cardFooter}>
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => {
                            setSelectedRequest(item);
                            setStatus(item.status);
                            setComment(item.comment || '');
                            setStatusModal(true);
                          }}
                        >
                          <LinearGradient
                            colors={['#8B5CF6', '#6366F1']}
                            style={styles.actionButtonGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                          >
                            <Ionicons name="create" size={18} color="#FFF" />
                            <Text style={styles.actionButtonText}>Update</Text>
                          </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => assignProjectFromRequest(item)}
                          disabled={assignedRequests.includes(item.id) || item.status !== 'approved'}
                        >
                          <LinearGradient
                            colors={assignedRequests.includes(item.id) ? 
                              ['#00D4AA', '#00B894'] : 
                              item.status === 'approved' ? ['#8B5CF6', '#6366F1'] : ['#CBD5E1', '#94A3B8']
                            }
                            style={styles.actionButtonGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                          >
                            <Ionicons 
                              name={assignedRequests.includes(item.id) ? 'checkmark-done' : 'checkmark'} 
                              size={18} 
                              color="#FFF" 
                            />
                            <Text style={styles.actionButtonText}>
                              {assignedRequests.includes(item.id) ? 'Assigned' : 'Assign'}
                            </Text>
                          </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => deleteProjectAssignedFromRequest(item)}
                        >
                          <LinearGradient
                            colors={['#FF6B9C', '#FF4775']}
                            style={styles.actionButtonGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                          >
                            <Ionicons name="trash" size={18} color="#FFF" />
                            <Text style={styles.actionButtonText}>Delete</Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                    </LinearGradient>
                  </Animatable.View>
                ))}
              </View>
            )}
          </Animatable.View>
        )}
      </ScrollView>

      {/* ✨ Ultra Premium Status Modal */}
      <Modal visible={statusModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Animatable.View
            animation="zoomIn" 
            duration={500}
            style={styles.modalContent}
          >
            <LinearGradient
              colors={['#8B5CF6', '#6366F1']}
              style={styles.modalHeader}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="settings" size={32} color="#FFF" />
              <View style={styles.modalHeaderText}>
                <Text style={styles.modalTitle}>Update Request Status</Text>
                <Text style={styles.modalSubtitle}>{selectedRequest?.projectTitle}</Text>
              </View>
            </LinearGradient>

            <View style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <View style={styles.inputLabelContainer}>
                  <Ionicons name="options" size={18} color="#6366F1" />
                  <Text style={styles.inputLabel}>Status</Text>
                </View>
                <LinearGradient
                  colors={['#F8FAFC', '#FFFFFF']}
                  style={styles.inputContainer}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <TextInput
                    placeholder="approved / rejected / pending"
                    placeholderTextColor="#94A3B8"
                    value={status}
                    onChangeText={setStatus}
                    style={styles.input}
                  />
                </LinearGradient>
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputLabelContainer}>
                  <Ionicons name="chatbox" size={18} color="#6366F1" />
                  <Text style={styles.inputLabel}>Comment (Optional)</Text>
                </View>
                <LinearGradient
                  colors={['#F8FAFC', '#FFFFFF']}
                  style={[styles.inputContainer, styles.textAreaContainer]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <TextInput
                    placeholder="Add your comments..."
                    placeholderTextColor="#94A3B8"
                    value={comment}
                    onChangeText={setComment}
                    style={[styles.input, styles.textArea]}
                    multiline
                    textAlignVertical="top"
                  />
                </LinearGradient>
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setStatusModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.modalButton}
                onPress={updateRequestStatus}
              >
                <LinearGradient
                  colors={['#8B5CF6', '#6366F1']}
                  style={styles.modalButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.modalButtonText}>Update Status</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animatable.View>
        </View>
      </Modal>

      {/* 🎭 Premium Dialog */}
      <Modal visible={dialog.visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Animatable.View
            animation={dialog.title.includes('✅') || dialog.title.includes('🎉') ? 'bounceIn' : 'shake'}
            duration={600}
            style={styles.dialogContent}
          >
            <Ionicons
              name={dialog.title.includes('✅') || dialog.title.includes('🎉') ? "checkmark-circle" : "alert-circle"}
              size={80}
              color={dialog.title.includes('✅') || dialog.title.includes('🎉') ? "#00D4AA" : "#FF6B9C"}
            />
            <Text style={styles.dialogTitle}>{dialog.title}</Text>
            <Text style={styles.dialogMessage}>{dialog.message}</Text>
            <TouchableOpacity
              onPress={() => setDialog({ ...dialog, visible: false })}
              style={styles.dialogButton}
            >
              <LinearGradient
                colors={['#8B5CF6', '#6366F1']}
                style={styles.dialogButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.dialogButtonText}>Continue</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animatable.View>
        </View>
      </Modal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  // 🔥 Ultra Premium Header
  header: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 25,
    position: 'relative',
    overflow: 'hidden',
  },
  headerBg1: {
    position: 'absolute',
    top: -100,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  headerBg2: {
    position: 'absolute',
    bottom: -80,
    left: -80,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerBg3: {
    position: 'absolute',
    top: '30%',
    right: '20%',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#FFF',
    opacity: 0.9,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  requestCount: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 15,
    alignItems: 'center',
  },
  requestCountText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 20,
  },
  requestCountLabel: {
    color: '#FFF',
    fontSize: 12,
    opacity: 0.9,
  },
  // 💫 Premium Tabs
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 25,
    marginTop: -25,
    borderRadius: 20,
    padding: 8,
    backgroundColor: '#FFF',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  tab: {
    flex: 1,
    borderRadius: 15,
    overflow: 'hidden',
    marginHorizontal: 4,
  },
  tabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 15,
  },
  tabText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  tabBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginLeft: 8,
  },
  tabBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  scrollContainer: {
    padding: 25,
    paddingBottom: 30,
  },
  // 🎨 Premium Sections
  createSection: {
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  requestsSection: {
    borderRadius: 25,
    padding: 25,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  sectionGradient: {
    padding: 25,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },
  sectionIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  // 📝 Premium Form
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 10,
  },
  inputLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  inputContainer: {
    borderRadius: 15,
    paddingHorizontal: 20,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  textAreaContainer: {
    paddingVertical: 16,
  },
  input: {
    fontSize: 16,
    paddingVertical: 12,
    color: '#1E293B',
  },
  textArea: {
    height: 120,
    paddingTop: 0,
  },
  // 🚀 Premium Buttons
  createButton: {
    borderRadius: 15,
    overflow: 'hidden',
    marginTop: 10,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  createButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 15,
  },
  createButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 18,
    marginLeft: 12,
  },
  // 💎 Premium Cards
  emptyContainer: {
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 50,
    borderRadius: 25,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
  },
  requestsList: {
    gap: 15,
  },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 6,
  },
  cardGradient: {
    padding: 0,
    overflow: 'hidden',
  },
  cardHeader: {
    padding: 25,
    paddingBottom: 20,
  },
  cardTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    flex: 1,
    marginRight: 15,
    lineHeight: 24,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFF',
  },
  cardBody: {
    paddingHorizontal: 25,
    paddingBottom: 25,
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#64748B',
  },
  description: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
  },
  commentContainer: {
    backgroundColor: '#F1F5F9',
    padding: 15,
    borderRadius: 12,
    marginTop: 8,
  },
  commentLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6366F1',
    marginBottom: 6,
  },
  commentText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    padding: 25,
    paddingTop: 0,
    gap: 10,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  // ✨ Premium Modals
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 25,
  },
  modalContent: {
    width: '100%',
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 25,
    elevation: 15,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 25,
  },
  modalHeaderText: {
    flex: 1,
    marginLeft: 15,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#FFF',
    opacity: 0.9,
  },
  modalBody: {
    backgroundColor: '#FFF',
    padding: 25,
    gap: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    padding: 25,
    paddingTop: 0,
    gap: 15,
  },
  modalButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalButtonGradient: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  cancelButtonText: {
    color: '#64748B',
    fontWeight: '600',
    fontSize: 16,
  },
  modalButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  // 🎭 Premium Dialog
  dialogContent: {
    backgroundColor: '#FFF',
    borderRadius: 25,
    padding: 30,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 25,
    elevation: 15,
  },
  dialogTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1E293B',
    textAlign: 'center',
    marginTop: 15,
    marginBottom: 10,
  },
  dialogMessage: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 25,
  },
  dialogButton: {
    borderRadius: 12,
    overflow: 'hidden',
    width: '100%',
  },
  dialogButtonGradient: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  dialogButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default SupervisorProjectTracking;