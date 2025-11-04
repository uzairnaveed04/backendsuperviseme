import React, { useState, useEffect, useRef, useContext } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  TextInput,
  Modal,
  Animated,
  Dimensions,
  StatusBar
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import * as Animatable from 'react-native-animatable';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  serverTimestamp,
  deleteDoc,
  doc,
  writeBatch,
  getDoc,
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { ProjectContext } from './ProjectTrackingContext';

const { width, height } = Dimensions.get('window');

const ProjectSubmissionScreen = () => {
  // Correctly use the useContext hook
  const {
    hiddenRequests,
    hiddenProjects,
    deleteRequest,
    deleteProject,
    clearAllRequests,
    clearAllProjects
  } = useContext(ProjectContext);

  const [availableProjects, setAvailableProjects] = useState([]);
  const [assignedProjects, setAssignedProjects] = useState([]);
  const [userEmail, setUserEmail] = useState(null);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [supervisorEmail, setSupervisorEmail] = useState('');
  const [description, setDescription] = useState('');
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogMessage, setDialogMessage] = useState('');
  const [statusModal, setStatusModal] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(null);
  const [activeTab, setActiveTab] = useState('recommendations');

  const blinkAnim = useRef(new Animated.Value(0)).current;
  const blinkButtonAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Fetch user email on mount
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      user ? setUserEmail(user.email) : null;
    });
    return unsubscribe;
  }, []);

  // Fetch available projects
  useEffect(() => {
    const q = query(
      collection(db, 'projects'),
      where('status', '==', 'available')
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const uniq = new Map();
      snap.forEach((d) => {
        const data = d.data();
        const title = data.title?.trim();
        if (title && !uniq.has(title)) {
          uniq.set(title, { id: d.id, ...data });
        }
      });
      setAvailableProjects(Array.from(uniq.values()));
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  // Fetch project requests
  useEffect(() => {
    if (!userEmail) return;
    const q = query(
      collection(db, 'projectRequests'),
      where('studentEmail', '==', userEmail)
    );
    const unsubscribe = onSnapshot(q, (s) => {
      setRequests(s.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsubscribe;
  }, [userEmail]);

  // Fetch assigned projects
  useEffect(() => {
    if (!userEmail) return;
    const q = query(
      collection(db, 'projects'),
      where('studentEmail', '==', userEmail)
    );
    const unsubscribe = onSnapshot(q, (s) => {
      setAssignedProjects(s.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsubscribe;
  }, [userEmail]);

  // Animation for blinking button
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(blinkButtonAnim, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(blinkButtonAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [blinkButtonAnim]);

  // Animation for approved status
  useEffect(() => {
    if (currentStatus?.status === 'approved') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(blinkAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(blinkAnim, {
            toValue: 0.3,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [currentStatus, blinkAnim]);

  // Fade in animation
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, []);

  // Pulse animation for cards
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.02,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const showDialog = (msg) => {
    setDialogMessage(msg);
    setDialogVisible(true);
  };

  // ✅ NEW SECURITY FUNCTION: Check if project already requested
  const hasAlreadyRequestedProject = (projectTitle, supervisorEmail) => {
    const cleanedStudentEmail = userEmail?.trim().toLowerCase();
    const cleanedSupervisorEmail = supervisorEmail?.trim().toLowerCase();
    const cleanedProjectTitle = projectTitle?.trim().toLowerCase();

    return requests.some(request => 
      request.studentEmail === cleanedStudentEmail &&
      request.supervisorEmail === cleanedSupervisorEmail &&
      request.projectTitle.toLowerCase() === cleanedProjectTitle &&
      request.status !== 'rejected' // Allow re-sending if previously rejected
    );
  };

  const sendProjectRequest = async () => {
    if (!selectedProject || !supervisorEmail || !description) {
        return showDialog('⚠️ Please fill all fields');
    }

    // ✅ NEW SECURITY CHECK: Prevent duplicate project requests
    if (hasAlreadyRequestedProject(selectedProject.title, supervisorEmail)) {
        return showDialog('❌ You have already sent a request for this project to this supervisor.');
    }

    setIsLoading(true);

    try {
        const cleanedSupervisorEmail = supervisorEmail.trim().toLowerCase();
        const cleanedStudentEmail = userEmail.trim().toLowerCase();
        const validDomains = ['@cuiatk.edu.pk', '@ciit-attock.edu.pk'];

        if (!validDomains.some(domain => cleanedSupervisorEmail.endsWith(domain))) {
            setIsLoading(false);
            return showDialog('⚠️ Enter a valid supervisor email');
        }

        const token = await getAuth().currentUser.getIdToken();
        const res = await fetch("https://backendsuperviseme.vercel.app/api/supervision-status", {
            headers: { Authorization: `Bearer ${token}` }
        });

        const raw = await res.text();
        let data;
        try {
            data = JSON.parse(raw);
        } catch (err) {
            setIsLoading(false);
            return showDialog("❌ Server error: Invalid response format");
        }

        // Check 1: Is the student supervised at all?
        if (!data.isSupervised) {
            setIsLoading(false);
            return showDialog('❌ You must first be supervised before sending a project request.');
        }

        // ✅ Check 2: Is the selected supervisor the one who approved the student?
        const approvedSupervisors = data.supervisors;
        if (!approvedSupervisors.includes(cleanedSupervisorEmail)) {
            setIsLoading(false);
            return showDialog('❌ Project requests can only be sent to your approved supervisor.');
        }

        const supervisorPart = cleanedSupervisorEmail.split('@')[0];
        const domainPart = cleanedSupervisorEmail.split('@')[1];
        const documentId = `${supervisorPart}@${domainPart}_${cleanedStudentEmail}`;

        await addDoc(collection(db, 'projectRequests'), {
            projectTitle: selectedProject.title,
            description: description,
            studentEmail: cleanedStudentEmail,
            supervisorEmail: cleanedSupervisorEmail,
            documentId: documentId,
            status: 'pending',
            comment: '',
            createdAt: serverTimestamp(),
        });

        setShowRequestModal(false);
        setDescription('');
        setSupervisorEmail('');
        setSelectedProject(null);
        setIsLoading(false);
        showDialog('✅ Project request sent!');

    } catch (e) {
        console.error("Error sending request: ", e);
        setIsLoading(false);
        showDialog('❌ Failed to send request');
    }
  };

  const openStatusDialog = (status, comment) => {
    setCurrentStatus({ status, comment });
    setStatusModal(true);
  };

  // ✅ Enhanced renderCard function with security check
  const renderCard = (item) => {
    const hasRequested = hasAlreadyRequestedProject(item.title, supervisorEmail);
    
    return (
      <Animatable.View
        animation="fadeInUp"
        duration={500}
        useNativeDriver
      >
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <LinearGradient
            colors={['#FFFFFF', '#F8FAFF']}
            style={styles.card}
          >
            <View style={styles.cardHeader}>
              <View style={styles.cardIconContainer}>
                <Ionicons name="document-text" size={20} color="#6C63FF" />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardSub}>Status: {item.status}</Text>
                {/* ✅ Show warning if already requested */}
                {hasRequested && (
                  <View style={styles.warningContainer}>
                    <Ionicons name="warning" size={14} color="#FFA726" />
                    <Text style={styles.warningText}>Already requested</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  hasRequested && styles.disabledBtn
                ]}
                onPress={() => {
                  if (hasRequested) {
                    showDialog('⚠️ You have already sent a request for this project.');
                    return;
                  }
                  setSelectedProject(item);
                  setShowRequestModal(true);
                }}
                disabled={hasRequested}
              >
                <Text style={[
                  styles.btnTxt,
                  hasRequested && styles.disabledBtnTxt
                ]}>
                  {hasRequested ? 'Already Requested' : 'Send Request'}
                </Text>
                <Ionicons 
                  name={hasRequested ? "checkmark" : "send"} 
                  size={16} 
                  color={hasRequested ? "#999" : "#fff"} 
                  style={{ marginLeft: 8 }} 
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => deleteProject(item.id)}
              >
                <Ionicons name="trash" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>
      </Animatable.View>
    );
  };

  if (isLoading) {
    return (
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.loadingWrap}>
        <Animatable.View
          animation="pulse"
          iterationCount="infinite"
          style={styles.loadingIcon}
        >
          <Ionicons name="rocket" size={60} color="#fff" />
        </Animatable.View>
        <Text style={styles.loadingTxt}>Loading Projects...</Text>
        <Text style={styles.loadingSubTxt}>Preparing your workspace</Text>
      </LinearGradient>
    );
  }

  const filteredRequests = requests.filter((req) => !hiddenRequests.includes(req.id));
  const filteredAssignedProjectsFromRequests = assignedProjects.filter(p => p.assignedFromRequest && !hiddenProjects.includes(p.id));
  const filteredDirectlyAssignedProjects = assignedProjects.filter(p => !p.assignedFromRequest && !hiddenProjects.includes(p.id));

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: '#f8faff' }}
    >
      <StatusBar backgroundColor="#667eea" barStyle="light-content" />
      
      {/* Enhanced Header */}
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.header}>
        <View style={styles.headerContent}>
          <Animatable.View animation="fadeInDown" duration={800}>
            <Text style={styles.headerTxt}>Project Hub</Text>
          </Animatable.View>
          <Animatable.View animation="fadeInDown" duration={800} delay={200}>
            <Text style={styles.headerSubTxt}>Manage your academic journey</Text>
          </Animatable.View>
        </View>
        <View style={styles.headerDecoration}>
          <Ionicons name="school" size={24} color="rgba(255,255,255,0.3)" />
        </View>
      </LinearGradient>

      {/* Enhanced Tab Navigation */}
      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {['recommendations', 'requests', 'assigned', 'direct'].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.activeTab]}
              onPress={() => setActiveTab(tab)}
            >
              <LinearGradient
                colors={activeTab === tab ? ['#6C63FF', '#8A7CFF'] : ['transparent', 'transparent']}
                style={styles.tabGradient}
              >
                <Ionicons 
                  name={
                    tab === 'recommendations' ? 'bulb' :
                    tab === 'requests' ? 'paper-plane' :
                    tab === 'assigned' ? 'checkmark-done' : 'create'
                  } 
                  size={16} 
                  color={activeTab === tab ? '#fff' : '#6C63FF'} 
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                  {tab === 'recommendations' ? 'Recommended' :
                   tab === 'requests' ? 'Requests' :
                   tab === 'assigned' ? 'Assigned' : 'Direct'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Enhanced Recommendations Banner */}
        <Animatable.View
          animation="fadeIn"
          duration={800}
          style={styles.banner}
        >
          <LinearGradient colors={['#6C63FF', '#8A7CFF']} style={styles.bannerGradient}>
            <View style={styles.bannerContent}>
              <View style={styles.bannerIconContainer}>
                <Ionicons name="bulb" size={28} color="#fff" />
              </View>
              <View style={styles.bannerTextContainer}>
                <Text style={styles.bannerTitle}>Smart Recommendations</Text>
                <Text style={styles.bannerTxt}>
                  Discover projects tailored to your academic interests
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.bannerBtn}
              onPress={() => setShowRecommendations((p) => !p)}
            >
              <Text style={styles.bannerBtnTxt}>
                {showRecommendations ? 'Hide' : 'View'} Recommendations
              </Text>
              <Ionicons
                name={showRecommendations ? 'chevron-up' : 'chevron-down'}
                size={18}
                color="#fff"
                style={{ marginLeft: 8 }}
              />
            </TouchableOpacity>
          </LinearGradient>
        </Animatable.View>

        {/* Recommended Projects */}
        {showRecommendations && (activeTab === 'recommendations' || !activeTab) && (
          <Animatable.View
            animation="fadeInUp"
            duration={600}
            style={styles.section}
          >
            <View style={styles.sectionHeader}>
              <LinearGradient colors={['#6C63FF', '#8A7CFF']} style={styles.sectionIcon}>
                <Ionicons name="list" size={20} color="#fff" />
              </LinearGradient>
              <Text style={styles.sectionTitle}>Available Projects</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{availableProjects.length}</Text>
              </View>
            </View>
            <FlatList
              data={availableProjects.filter(item => !hiddenProjects.includes(item.id))}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => renderCard(item)}
              scrollEnabled={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="sad" size={48} color="#ccc" />
                  <Text style={styles.emptyTxt}>No available projects at the moment</Text>
                  <Text style={styles.emptySubTxt}>Check back later for new opportunities</Text>
                </View>
              }
            />
          </Animatable.View>
        )}

        {/* Enhanced Sent Requests Section */}
        {(activeTab === 'requests' || !activeTab) && (
          <Animatable.View
            animation="fadeInUp"
            duration={600}
            style={styles.section}
          >
            <View style={styles.sectionHeader}>
              <LinearGradient colors={['#FF6B6B', '#FF8E8E']} style={styles.sectionIcon}>
                <Ionicons name="paper-plane" size={20} color="#fff" />
              </LinearGradient>
              <Text style={styles.sectionTitle}>Your Sent Requests</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{filteredRequests.length}</Text>
              </View>
            </View>

            <View style={styles.rowBetween}>
              <Text style={styles.sectionSubtitle}>{filteredRequests.length} request(s) sent</Text>
              {filteredRequests.length > 0 && (
                <TouchableOpacity onPress={() => clearAllRequests(requests)} style={styles.dangerBtn}>
                  <Ionicons name="trash-bin" size={18} color="#fff" />
                  <Text style={[styles.btnTxt, { marginLeft: 6 }]}>Clear All</Text>
                </TouchableOpacity>
              )}
            </View>

            {filteredRequests.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="send" size={48} color="#ccc" />
                <Text style={styles.emptyTxt}>No requests sent yet</Text>
                <Text style={styles.emptySubTxt}>Send your first project request to get started</Text>
              </View>
            ) : (
              filteredRequests.map((req) => (
                <Animatable.View
                  key={req.id}
                  animation="fadeIn"
                  duration={400}
                  useNativeDriver
                  style={{ marginBottom: 12 }}
                >
                  <LinearGradient colors={['#FFFFFF', '#F8FAFF']} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={styles.cardIconContainer}>
                        <Ionicons name="document" size={20} color="#6C63FF" />
                      </View>
                      <View style={styles.cardContent}>
                        <Text style={styles.cardTitle} numberOfLines={1}>{req.projectTitle}</Text>
                        <Text style={styles.cardSub}>To: {req.supervisorEmail}</Text>
                      </View>
                      <Text style={[
                        styles.statusBadge,
                        req.status === 'approved' && styles.statusApproved,
                        req.status === 'pending' && styles.statusPending,
                        req.status === 'rejected' && styles.statusRejected,
                      ]}>
                        {req.status}
                      </Text>
                    </View>

                    <View style={styles.rowBetween}>
                      {req.status === 'approved' ? (
                        <Animated.View
                          style={{
                            opacity: blinkButtonAnim,
                            transform: [{ scale: blinkButtonAnim }]
                          }}
                        >
                          <TouchableOpacity
                            onPress={() => openStatusDialog(req.status, req.comment)}
                            style={styles.successBtn}
                          >
                            <Ionicons name="checkmark-circle" size={16} color="#fff" />
                            <Text style={styles.btnTxt}>View Status</Text>
                          </TouchableOpacity>
                        </Animated.View>
                      ) : (
                        <TouchableOpacity
                          onPress={() => openStatusDialog(req.status, req.comment)}
                          style={styles.secondaryBtn}
                        >
                          <Ionicons name="information-circle" size={16} color="#fff" />
                          <Text style={styles.btnTxt}>View Status</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        onPress={() => deleteRequest(req.id)}
                        style={styles.iconBtn}
                      >
                        <Ionicons name="trash" size={20} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </LinearGradient>
                </Animatable.View>
              ))
            )}
          </Animatable.View>
        )}

        {/* Enhanced Assigned Projects */}
        {(activeTab === 'assigned' || !activeTab) && (
          <Animatable.View
            animation="fadeInUp"
            duration={600}
            style={styles.section}
          >
            <View style={styles.sectionHeader}>
              <LinearGradient colors={['#4ECDC4', '#66D6D6']} style={styles.sectionIcon}>
                <Ionicons name="checkmark-done" size={20} color="#fff" />
              </LinearGradient>
              <Text style={styles.sectionTitle}>Assigned Projects</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{filteredAssignedProjectsFromRequests.length}</Text>
              </View>
            </View>
            {filteredAssignedProjectsFromRequests.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="folder-open" size={48} color="#ccc" />
                <Text style={styles.emptyTxt}>No projects assigned yet</Text>
                <Text style={styles.emptySubTxt}>Your approved requests will appear here</Text>
              </View>
            ) : (
              filteredAssignedProjectsFromRequests.map((proj) => (
                <Animatable.View
                  key={proj.id}
                  animation="fadeInUp"
                  duration={400}
                  useNativeDriver
                  style={{ marginBottom: 12 }}
                >
                  <LinearGradient colors={['#FFFFFF', '#F8FAFF']} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={styles.cardIconContainer}>
                        <Ionicons name="rocket" size={20} color="#6C63FF" />
                      </View>
                      <View style={styles.cardContent}>
                        <Text style={styles.cardTitle} numberOfLines={1}>{proj.title}</Text>
                        <Text style={styles.cardSub}>
                          <Ionicons name="person" size={14} color="#6C63FF" /> {proj.supervisorEmail}
                        </Text>
                        {proj.deadline && (
                          <View style={styles.deadlineContainer}>
                            <Ionicons name="calendar" size={14} color="#FF5C5C" />
                            <Text style={styles.deadlineTxt}> Deadline: {proj.deadline}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[
                        styles.statusBadge,
                        proj.status === 'approved' && styles.statusApproved,
                        proj.status === 'pending' && styles.statusPending,
                        proj.status === 'rejected' && styles.statusRejected,
                      ]}>
                        {proj.status}
                      </Text>
                    </View>
                  </LinearGradient>
                </Animatable.View>
              ))
            )}
          </Animatable.View>
        )}

        {/* Enhanced Directly Assigned */}
        {(activeTab === 'direct' || !activeTab) && (
          <Animatable.View
            animation="fadeInUp"
            duration={600}
            style={styles.section}
          >
            <View style={styles.sectionHeader}>
              <LinearGradient colors={['#FFA726', '#FFB74D']} style={styles.sectionIcon}>
                <Ionicons name="create" size={20} color="#fff" />
              </LinearGradient>
              <Text style={styles.sectionTitle}>Direct Assignments</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{filteredDirectlyAssignedProjects.length}</Text>
              </View>
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionSubtitle}>
                {filteredDirectlyAssignedProjects.length} project(s)
              </Text>
              {filteredDirectlyAssignedProjects.length > 0 && (
                <TouchableOpacity onPress={() => clearAllProjects(assignedProjects)} style={styles.dangerBtn}>
                  <Ionicons name="trash-bin" size={18} color="#fff" />
                  <Text style={[styles.btnTxt, { marginLeft: 6 }]}>Clear All</Text>
                </TouchableOpacity>
              )}
            </View>

            {filteredDirectlyAssignedProjects.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="document" size={48} color="#ccc" />
                <Text style={styles.emptyTxt}>No direct assignments</Text>
                <Text style={styles.emptySubTxt}>Direct assignments from supervisors will appear here</Text>
              </View>
            ) : (
              filteredDirectlyAssignedProjects.map((proj) => (
                <Animatable.View
                  key={proj.id}
                  animation="fadeInUp"
                  duration={400}
                  useNativeDriver
                  style={{ marginBottom: 12 }}
                >
                  <LinearGradient colors={['#FFFFFF', '#F8FAFF']} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={styles.cardIconContainer}>
                        <Ionicons name="star" size={20} color="#6C63FF" />
                      </View>
                      <View style={styles.cardContent}>
                        <Text style={styles.cardTitle} numberOfLines={1}>{proj.title}</Text>
                        <Text style={styles.cardSub}>
                          <Ionicons name="person" size={14} color="#6C63FF" /> {proj.supervisorEmail}
                        </Text>
                        {proj.description && (
                          <Text style={styles.descriptionText}>
                            <Ionicons name="document-text" size={14} color="#6C63FF" /> {proj.description}
                          </Text>
                        )}
                        {proj.deadline && (
                          <View style={styles.deadlineContainer}>
                            <Ionicons name="calendar" size={14} color="#FF5C5C" />
                            <Text style={styles.deadlineTxt}> Deadline: {proj.deadline}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[
                        styles.statusBadge,
                        proj.status === 'approved' && styles.statusApproved,
                        proj.status === 'pending' && styles.statusPending,
                        proj.status === 'rejected' && styles.statusRejected,
                      ]}>
                        {proj.status}
                      </Text>
                    </View>
                  </LinearGradient>
                </Animatable.View>
              ))
            )}
          </Animatable.View>
        )}
      </ScrollView>

      {/* Enhanced Request Modal */}
      <Modal visible={showRequestModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <Animatable.View
            animation="slideInUp"
            duration={500}
            style={styles.modalBox}
          >
            <LinearGradient colors={['#6C63FF', '#8A7CFF']} style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Send Project Request</Text>
              <TouchableOpacity onPress={() => setShowRequestModal(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>
            
            <View style={styles.modalContent}>
              <View style={styles.projectInfo}>
                <LinearGradient colors={['#6C63FF', '#8A7CFF']} style={styles.projectIcon}>
                  <Ionicons name="document-text" size={24} color="#fff" />
                </LinearGradient>
                <Text style={styles.projectTitle}>{selectedProject?.title}</Text>
              </View>
              
              {/* ✅ Security Warning in Modal */}
              {selectedProject && hasAlreadyRequestedProject(selectedProject.title, supervisorEmail) && (
                <View style={styles.securityWarning}>
                  <Ionicons name="warning" size={20} color="#FFA726" />
                  <Text style={styles.securityWarningText}>
                    You have already sent a request for this project to this supervisor.
                  </Text>
                </View>
              )}
              
              <View style={styles.inputContainer}>
                <Ionicons name="mail" size={20} color="#6C63FF" style={styles.inputIcon} />
                <TextInput
                  placeholder="Supervisor Email"
                  placeholderTextColor="#999"
                  style={styles.input}
                  value={supervisorEmail}
                  onChangeText={setSupervisorEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              
              <View style={styles.inputContainer}>
                <Ionicons name="document-text" size={20} color="#6C63FF" style={styles.inputIcon} />
                <TextInput
                  placeholder="Project Description"
                  placeholderTextColor="#999"
                  style={[styles.input, styles.textArea]}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
              
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  onPress={() => setShowRequestModal(false)}
                  style={[styles.modalBtn, styles.cancelBtn]}
                >
                  <Text style={styles.cancelBtnTxt}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={sendProjectRequest}
                  style={[styles.modalBtn, styles.submitBtn]}
                  disabled={selectedProject && hasAlreadyRequestedProject(selectedProject.title, supervisorEmail)}
                >
                  <LinearGradient 
                    colors={
                      selectedProject && hasAlreadyRequestedProject(selectedProject.title, supervisorEmail) 
                        ? ['#CCCCCC', '#999999'] 
                        : ['#6C63FF', '#8A7CFF']
                    } 
                    style={styles.submitGradient}
                  >
                    <Text style={styles.submitBtnTxt}>
                      {selectedProject && hasAlreadyRequestedProject(selectedProject.title, supervisorEmail) 
                        ? 'Already Requested' 
                        : 'Send Request'
                      }
                    </Text>
                    <Ionicons 
                      name={
                        selectedProject && hasAlreadyRequestedProject(selectedProject.title, supervisorEmail) 
                          ? "checkmark" 
                          : "send"
                      } 
                      size={18} 
                      color="#fff" 
                      style={{ marginLeft: 8 }} 
                    />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </Animatable.View>
        </View>
      </Modal>

      {/* Enhanced Dialog Modal */}
      <Modal visible={dialogVisible} transparent animationType="fade">
        <View style={styles.dialogOverlay}>
          <Animatable.View
            animation="zoomIn"
            duration={300}
            style={styles.dialogBox}
          >
            <Ionicons
              name={dialogMessage.includes('✅') ? 'checkmark-circle' :
                dialogMessage.includes('⚠️') ? 'warning' :
                  dialogMessage.includes('❌') ? 'close-circle' : 'information-circle'}
              size={52}
              color={
                dialogMessage.includes('✅') ? '#4CAF50' :
                  dialogMessage.includes('⚠️') ? '#FFC107' :
                    dialogMessage.includes('❌') ? '#F44336' : '#6C63FF'
              }
              style={{ marginBottom: 16 }}
            />
            <Text style={styles.dialogTxt}>{dialogMessage.replace(/[⚠️✅❌🗑️]/g, '').trim()}</Text>
            <TouchableOpacity
              onPress={() => setDialogVisible(false)}
              style={styles.dialogBtn}
            >
              <LinearGradient colors={['#6C63FF', '#8A7CFF']} style={styles.dialogBtnGradient}>
                <Text style={styles.dialogBtnTxt}>OK</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animatable.View>
        </View>
      </Modal>

      {/* Enhanced Status Modal */}
      <Modal visible={statusModal} transparent animationType="fade">
        <View style={styles.dialogOverlay}>
          <Animatable.View
            animation="zoomIn"
            duration={300}
            style={styles.dialogBox}
          >
            {currentStatus?.status === 'approved' ? (
              <Animatable.View
                animation="bounceIn"
                style={styles.statusIconContainer}
              >
                <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
              </Animatable.View>
            ) : currentStatus?.status === 'rejected' ? (
              <Animatable.View
                animation="shake"
                style={styles.statusIconContainer}
              >
                <Ionicons name="close-circle" size={80} color="#F44336" />
              </Animatable.View>
            ) : (
              <Animatable.View
                animation="rotate"
                iterationCount="infinite"
                style={styles.statusIconContainer}
              >
                <Ionicons name="time" size={80} color="#FFC107" />
              </Animatable.View>
            )}
            
            <Text style={styles.dialogTitle}>
              Request Status
            </Text>
            
            <Text style={styles.dialogTxt}>
              Status:{' '}
              {currentStatus?.status === 'approved' ? (
                <Animated.Text
                  style={{
                    fontWeight: 'bold',
                    color: '#00c853',
                    opacity: blinkAnim
                  }}
                >
                  {currentStatus?.status.toUpperCase()}
                </Animated.Text>
              ) : (
                <Text style={{
                  fontWeight: 'bold',
                  color: currentStatus?.status === 'rejected' ? '#F44336' : '#FFC107'
                }}>
                  {currentStatus?.status.toUpperCase()}
                </Text>
              )}
            </Text>

            {currentStatus?.comment ? (
              <View style={styles.commentContainer}>
                <Ionicons name="chatbubble" size={20} color="#6C63FF" />
                <Text style={styles.commentTxt}>{currentStatus.comment}</Text>
              </View>
            ) : (
              <Text style={styles.noCommentTxt}>No comments provided</Text>
            )}

            <TouchableOpacity
              onPress={() => setStatusModal(false)}
              style={styles.dialogBtn}
            >
              <LinearGradient colors={['#6C63FF', '#8A7CFF']} style={styles.dialogBtnGradient}>
                <Text style={styles.dialogBtnTxt}>Close</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animatable.View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

/* -------------------------------------------------------------------------- */
/*                              Enhanced Styles                              */
/* -------------------------------------------------------------------------- */
const styles = StyleSheet.create({
  // Enhanced Header
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 25,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    elevation: 8,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  headerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTxt: { 
    color: '#fff', 
    fontSize: 28, 
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  headerSubTxt: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    textAlign: 'center',
  },
  headerDecoration: {
    position: 'absolute',
    top: 20,
    right: 20,
    opacity: 0.2,
  },

  // Enhanced Tab Navigation
  tabContainer: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  tabScroll: {
    paddingHorizontal: 16,
  },
  tab: {
    marginHorizontal: 4,
    borderRadius: 20,
    overflow: 'hidden',
  },
  tabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  activeTab: {
    // Gradient is handled in tabGradient
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },

  // Enhanced Container
  container: { 
    flex: 1, 
    padding: 16,
    backgroundColor: '#f8faff',
  },
  contentContainer: {
    paddingBottom: 40,
  },

  // Enhanced Banner
  banner: {
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
  },
  bannerGradient: {
    padding: 25,
    borderRadius: 20,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  bannerIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  bannerTxt: { 
    fontSize: 14, 
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 20,
  },
  bannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  bannerBtnTxt: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },

  // Enhanced Sections
  section: {
    marginBottom: 24,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionTitle: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: '#333',
    flex: 1,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  badge: {
    backgroundColor: '#6C63FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },

  // Enhanced Cards
  card: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.1)',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#333',
    marginBottom: 4,
  },
  cardSub: { 
    fontSize: 14, 
    color: '#666',
    lineHeight: 20,
  },
  statusBadge: {
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    textTransform: 'capitalize',
  },
  statusApproved: {
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
  },
  statusPending: {
    backgroundColor: '#fff8e1',
    color: '#ff8f00',
  },
  statusRejected: {
    backgroundColor: '#ffebee',
    color: '#c62828',
  },
  deadlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  deadlineTxt: {
    fontStyle: 'italic',
    fontSize: 13,
    color: '#FF5C5C',
    fontWeight: '500',
  },

  // Enhanced Empty States
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyTxt: { 
    fontStyle: 'italic', 
    color: '#999',
    marginTop: 12,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '500',
  },
  emptySubTxt: {
    color: '#ccc',
    textAlign: 'center',
    marginTop: 4,
    fontSize: 14,
  },

  // Enhanced Loading
  loadingWrap: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  loadingIcon: {
    marginBottom: 20,
  },
  loadingTxt: { 
    marginTop: 10, 
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
  },
  loadingSubTxt: {
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
    fontSize: 14,
  },

  // Enhanced Buttons (Shadow removed)
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6C63FF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 8,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4A6FA5',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  successBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00c853',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    // No shadow property
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF5C5C',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    // No shadow property
  },
  btnTxt: { 
    color: '#fff', 
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 6,
  },
  iconBtn: {
    backgroundColor: '#FF5C5C',
    padding: 10,
    borderRadius: 10,
    marginLeft: 10,
    // No shadow property
  },

  // Button Container
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },

  // Enhanced Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: '#0009',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    backgroundColor: '#fff',
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    maxHeight: height * 0.8,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeBtn: {
    padding: 4,
  },
  modalContent: {
    padding: 24,
  },
  projectInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 16,
  },
  projectIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  projectTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    marginBottom: 20,
    paddingHorizontal: 16,
    backgroundColor: '#fafafa',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  modalBtn: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cancelBtn: {
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  submitBtn: {
    marginLeft: 12,
  },
  cancelBtnTxt: {
    paddingVertical: 14,
    textAlign: 'center',
    color: '#666',
    fontWeight: '600',
    fontSize: 16,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  submitBtnTxt: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },

  // Enhanced Dialog
  dialogOverlay: {
    flex: 1,
    backgroundColor: '#0006',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialogBox: {
    backgroundColor: '#fff',
    width: '100%',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  dialogTxt: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
    color: '#555',
    lineHeight: 24,
  },
  dialogBtn: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  dialogBtnGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  dialogBtnTxt: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  commentContainer: {
    flexDirection: 'row',
    backgroundColor: '#f5f7fa',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    width: '100%',
  },
  commentTxt: {
    flex: 1,
    fontSize: 14,
    color: '#555',
    marginLeft: 8,
    lineHeight: 20,
  },
  noCommentTxt: {
    fontStyle: 'italic',
    color: '#999',
    marginBottom: 20,
    textAlign: 'center',
  },

  // Utility Styles
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  descriptionText: {
    fontSize: 14,
    color: '#555',
    marginVertical: 8,
    lineHeight: 20,
  },
  statusIconContainer: {
    marginBottom: 20,
  },
   warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  warningText: {
    fontSize: 12,
    color: '#856404',
    marginLeft: 4,
    fontWeight: '500',
  },
  disabledBtn: {
    backgroundColor: '#CCCCCC',
  },
  disabledBtnTxt: {
    color: '#999999',
  },
  securityWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FFA726',
  },
  securityWarningText: {
    fontSize: 14,
    color: '#856404',
    marginLeft: 8,
    flex: 1,
    fontWeight: '500',
  },
});

export default ProjectSubmissionScreen;