import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    TextInput,
    Modal,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Animated,
    Dimensions,
} from "react-native";
import { db } from "../../firebaseConfig";
import {
    collection,
    addDoc,
    onSnapshot,
    query,
    where,
    serverTimestamp,
    getDocs
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import Ionicons from "react-native-vector-icons/Ionicons";
import LinearGradient from "react-native-linear-gradient";

const { width, height } = Dimensions.get('window');

const CommunicationTool = ({ navigation }) => {
    const [supervisors, setSupervisors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSupervisor, setSelectedSupervisor] = useState(null);
    const [studentEmail, setStudentEmail] = useState("");
    const [message, setMessage] = useState("");
    const [sentMessages, setSentMessages] = useState([]);
    const [showDialog, setShowDialog] = useState(false);
    const [dialogMessage, setDialogMessage] = useState("");
    const [unreadCounts, setUnreadCounts] = useState({});
    const [activeTab, setActiveTab] = useState('supervisors');
    
    // Lightweight animations only
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const headerAnim = useRef(new Animated.Value(0)).current;

    const colors = {
        primary: '#8B5CF6',
        secondary: '#6366F1',
        accent: '#00D4AA',
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#FF6B9C',
        light: '#F8FAFC',
        dark: '#1E293B',
        muted: '#94A3B8',
        card: '#FFFFFF',
        background: '#0F172A'
    };

    useEffect(() => {
        // Simple sequential animations
        Animated.sequence([
            Animated.timing(headerAnim, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            })
        ]).start();

        const auth = getAuth();
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setStudentEmail(user.email);
                fetchMessages(user.email);
            }
        });

        fetchSupervisors();

        return () => unsubscribe();
    }, []);

    const fetchSupervisors = async () => {
        try {
            setLoading(true);
            const token = await getAuth().currentUser.getIdToken();

            const res = await fetch(
                'https://backendsuperviseme.vercel.app/api/all-supervisors',
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || "Failed to fetch supervisors");
            }

            const data = await res.json();

            if (data.success) {
                setSupervisors(data.supervisors);
            } else {
                throw new Error(data.message || "Backend error");
            }
        } catch (error) {
            console.error("Error fetching supervisors:", error);
            setDialogMessage("Failed to load supervisors. Please check your network and try again.");
            setShowDialog(true);
        } finally {
            setLoading(false);
        }
    };

    const fetchMessages = (email) => {
        const q = query(collection(db, "messages"), where("senderId", "==", email));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const messages = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));
            setSentMessages(messages);

            const newUnreadCounts = {};
            messages.forEach((msg) => {
                if (msg.status === "Approved") {
                    newUnreadCounts[msg.receiverId] = 0;
                }
            });
            setUnreadCounts(newUnreadCounts);
        });

        return unsubscribe;
    };

    const sendRequest = async () => {
        if (!selectedSupervisor || !message.trim()) {
            setDialogMessage("Please select a supervisor and write a message.");
            setShowDialog(true);
            return;
        }

        try {
            const token = await getAuth().currentUser.getIdToken();
            const response = await fetch(
                `https://backendsuperviseme.vercel.app/api/check-supervisor/${selectedSupervisor.email}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const data = await response.json();

            if (!data.available) {
                setDialogMessage("This supervisor already has 3 students.");
                setShowDialog(true);
                return;
            }

            const senderEmail = (studentEmail || '').trim().toLowerCase();
            const receiverEmail = (selectedSupervisor.email || '').trim().toLowerCase();

            const q = query(
                collection(db, "messages"),
                where("senderId", "==", senderEmail),
                where("receiverId", "==", receiverEmail)
            );

            const snapshot = await getDocs(q);

            const alreadyExists = snapshot.docs.some(
                (doc) => doc.data().status === "Pending" || doc.data().status === "Approved"
            );

            if (alreadyExists) {
                setDialogMessage("You have already sent a request to this supervisor.");
                setShowDialog(true);
                return;
            }

            await addDoc(collection(db, "messages"), {
                senderId: senderEmail,
                receiverId: receiverEmail,
                message,
                status: "Pending",
                createdAt: serverTimestamp(),
            });

            setMessage("");
            setDialogMessage("🎉 Request sent successfully!");
            setShowDialog(true);
            setActiveTab('requests');
        } catch (error) {
            console.error("Error sending request:", error);
            setDialogMessage("❌ Failed to send request. Please try again.");
            setShowDialog(true);
        }
    };

    // Simple debounce without complex logic
    const handleSupervisorPress = useCallback((item) => {
        setSelectedSupervisor(item);
    }, []);

    // Optimized SupervisorItem with minimal animations
    const SupervisorItem = React.memo(({ item, selectedSupervisor, onSupervisorPress, index }) => {
        const isSelected = selectedSupervisor?.email === item.email;
        const scaleAnim = useRef(new Animated.Value(0.95)).current;

        useEffect(() => {
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 50,
                friction: 7,
                delay: index * 50,
                useNativeDriver: true,
            }).start();
        }, []);

        const handlePress = () => {
            if (item.available) {
                onSupervisorPress(item);
            } else {
                setDialogMessage("This supervisor already has 3 students.");
                setShowDialog(true);
            }
        };

        return (
            <Animated.View 
                style={[
                    styles.supervisorItemWrapper,
                    { transform: [{ scale: scaleAnim }] }
                ]}
            >
                <TouchableOpacity
                    style={[
                        styles.supervisorItem,
                        isSelected && styles.selectedSupervisor,
                        !item.available && styles.unavailableSupervisor
                    ]}
                    onPress={handlePress}
                    activeOpacity={0.8}
                >
                    {/* Premium Avatar with Gradient */}
                    <LinearGradient
                        colors={
                            isSelected
                                ? ['#8B5CF6', '#6366F1']
                                : ['#FFFFFF', '#F8FAFC']
                        }
                        style={styles.avatarGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <View style={styles.avatarContainer}>
                            <Ionicons
                                name={item.avatar || "person"}
                                size={26}
                                color={isSelected ? 'white' : '#8B5CF6'}
                            />
                        </View>
                    </LinearGradient>

                    {/* Supervisor Info */}
                    <View style={styles.supervisorInfo}>
                        <Text style={[styles.supervisorName, isSelected && styles.selectedText]}>
                            {item.name}
                        </Text>
                        <Text style={[styles.supervisorSpecialty, isSelected && styles.selectedText]}>
                            {item.specialty}
                        </Text>
                        <Text style={[styles.supervisorEmail, isSelected && styles.selectedText]}>
                            {item.email}
                        </Text>
                    </View>

                    {/* Selection Indicator */}
                    {isSelected && (
                        <View style={styles.selectedIndicator}>
                            <Ionicons name="checkmark" size={20} color="#8B5CF6" />
                        </View>
                    )}

                    {/* Availability Badge */}
                    {!item.available && (
                        <View style={styles.limitedBadge}>
                            <Text style={styles.limitedText}>FULL</Text>
                        </View>
                    )}

                    {/* Premium Glow Effect */}
                    {isSelected && <View style={styles.glowEffect} />}
                </TouchableOpacity>
            </Animated.View>
        );
    }, (prevProps, nextProps) => {
        return (
            prevProps.item.id === nextProps.item.id &&
            prevProps.selectedSupervisor?.email === nextProps.selectedSupervisor?.email &&
            prevProps.item.available === nextProps.item.available
        );
    });

    const renderSupervisorItem = useCallback(({ item, index }) => (
        <SupervisorItem
            item={item}
            index={index}
            selectedSupervisor={selectedSupervisor}
            onSupervisorPress={handleSupervisorPress}
        />
    ), [selectedSupervisor, handleSupervisorPress]);

    // Optimized MessageItem with fancy UI but no heavy animations
    const MessageItem = React.memo(({ item, studentEmail, supervisors, navigation, unreadCounts, index }) => {
        const statusColors = {
            Approved: '#00D4AA',
            Rejected: '#FF6B9C',
            Pending: '#F59E0B'
        };

        const statusIcons = {
            Approved: "checkmark-circle",
            Rejected: "close-circle",
            Pending: "time"
        };

        const translateY = useRef(new Animated.Value(20)).current;
        const opacity = useRef(new Animated.Value(0)).current;

        useEffect(() => {
            Animated.parallel([
                Animated.timing(translateY, {
                    toValue: 0,
                    duration: 400,
                    delay: index * 80,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 400,
                    delay: index * 80,
                    useNativeDriver: true,
                })
            ]).start();
        }, []);

        return (
            <Animated.View 
                style={[
                    styles.messageItemWrapper,
                    { opacity, transform: [{ translateY }] }
                ]}
            >
                <View style={[
                    styles.messageBox,
                    { borderLeftColor: statusColors[item.status] }
                ]}>
                    {/* Message Header */}
                    <View style={styles.messageHeader}>
                        <LinearGradient
                            colors={[statusColors[item.status], statusColors[item.status] + 'DD']}
                            style={styles.statusIndicator}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <Ionicons
                                name={statusIcons[item.status]}
                                size={18}
                                color="white"
                            />
                        </LinearGradient>
                        <Text style={styles.supervisorText}>To: {item.receiverId.split('@')[0]}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: statusColors[item.status] + '20' }]}>
                            <Text style={[styles.statusText, { color: statusColors[item.status] }]}>
                                {item.status}
                            </Text>
                        </View>
                    </View>

                    {/* Message Content */}
                    <Text style={styles.messageText}>{item.message}</Text>

                    {/* Action Buttons */}
                    {item.status === "Approved" && (
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() =>
                                navigation.navigate("ChatsScreen", {
                                    studentId: studentEmail,
                                    supervisorId: item.receiverId,
                                })
                            }
                            activeOpacity={0.9}
                        >
                            <LinearGradient
                                colors={['#00D4AA', '#00B894']}
                                style={styles.actionButtonGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <Ionicons name="chatbubbles" size={18} color="white" />
                                <Text style={styles.actionButtonText}>Open Chat</Text>
                                {unreadCounts[item.receiverId] > 0 && (
                                    <View style={styles.unreadBadge}>
                                        <Text style={styles.unreadBadgeText}>
                                            {unreadCounts[item.receiverId]}
                                        </Text>
                                    </View>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    )}

                    {item.status === "Rejected" && (
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => {
                                const supervisor = supervisors.find(s => s.email === item.receiverId);
                                if (supervisor) {
                                    setSelectedSupervisor(supervisor);
                                    setActiveTab('supervisors');
                                }
                            }}
                            activeOpacity={0.9}
                        >
                            <LinearGradient
                                colors={['#94A3B8', '#64748B']}
                                style={styles.actionButtonGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <Ionicons name="refresh" size={18} color="white" />
                                <Text style={styles.actionButtonText}>Try Another</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    )}
                </View>
            </Animated.View>
        );
    }, (prevProps, nextProps) => {
        return (
            prevProps.item.id === nextProps.item.id &&
            prevProps.unreadCounts[prevProps.item.receiverId] === nextProps.unreadCounts[nextProps.item.receiverId]
        );
    });

    const renderMessageItem = useCallback(({ item, index }) => (
        <MessageItem
            item={item}
            index={index}
            studentEmail={studentEmail}
            supervisors={supervisors}
            navigation={navigation}
            unreadCounts={unreadCounts}
        />
    ), [studentEmail, supervisors, unreadCounts]);

    const renderMessageInput = () => {
        if (!selectedSupervisor) return null;
        
        return (
            <Animated.View 
                style={[
                    styles.messageInputContainer,
                    { opacity: fadeAnim }
                ]}
            >
                <LinearGradient
                    colors={['#FFFFFF', '#F8FAFC']}
                    style={styles.messageInputGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    {/* Selected Supervisor Header */}
                    <View style={styles.selectedSupervisorHeader}>
                        <LinearGradient
                            colors={['#8B5CF620', '#6366F120']}
                            style={styles.selectedAvatar}
                        >
                            <Ionicons name="person" size={24} color="#8B5CF6" />
                        </LinearGradient>
                        <View style={styles.selectedSupervisorInfo}>
                            <Text style={styles.selectedName}>{selectedSupervisor.name}</Text>
                            <Text style={styles.selectedEmail}>{selectedSupervisor.email}</Text>
                        </View>
                        <View style={styles.typingIndicator}>
                            <Ionicons name="ellipsis-horizontal" size={16} color="#8B5CF6" />
                        </View>
                    </View>
                    
                    {/* Message Input */}
                    <Text style={styles.messageLabel}>
                        ✨ Your Request Message
                    </Text>
                    <LinearGradient
                        colors={['#F8FAFC', '#FFFFFF']}
                        style={styles.textInputContainer}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <TextInput
                            value={message}
                            onChangeText={setMessage}
                            placeholder="Write your amazing request message here... 🌟"
                            placeholderTextColor="#94A3B8"
                            style={styles.textInput}
                            multiline
                            textAlignVertical="top"
                        />
                    </LinearGradient>

                    {/* Send Button */}
                    <TouchableOpacity
                        style={styles.sendButton}
                        onPress={sendRequest}
                        activeOpacity={0.9}
                    >
                        <LinearGradient
                            colors={['#8B5CF6', '#6366F1', '#4F46E5']}
                            style={styles.sendButtonGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <Ionicons name="send" size={20} color="white" />
                            <Text style={styles.sendButtonText}>🚀 Send Request</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </LinearGradient>
            </Animated.View>
        );
    };

    // Optimized FlatList configuration for performance
    const getItemLayout = useCallback((data, index) => ({
        length: 160,
        offset: 160 * index,
        index,
    }), []);

    const keyExtractor = useCallback((item) => item.id || item.email, []);

    return (
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
            {/* Premium Header */}
            <Animated.View 
                style={[
                    styles.header,
                    { 
                        opacity: headerAnim,
                        transform: [{
                            translateY: headerAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [-50, 0]
                            })
                        }]
                    }
                ]}
            >
                <LinearGradient
                    colors={['#8B5CF6', '#6366F1', '#4F46E5']}
                    style={styles.headerGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    {/* Header Background Elements */}
                    <View style={styles.headerOrb1} />
                    <View style={styles.headerOrb2} />
                    
                    <View style={styles.headerContent}>
                        <View style={styles.headerIconContainer}>
                            <Ionicons name="chatbox-ellipses" size={32} color="white" />
                        </View>
                        <View style={styles.headerTextContainer}>
                            <Text style={styles.headerTitle}>Communication Hub</Text>
                            <Text style={styles.headerSubtitle}>Connect with Expert Supervisors</Text>
                        </View>
                        <LinearGradient
                            colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
                            style={styles.headerBadge}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <Text style={styles.headerBadgeText}>{supervisors.length}</Text>
                            <Text style={styles.headerBadgeLabel}>Available</Text>
                        </LinearGradient>
                    </View>
                </LinearGradient>
            </Animated.View>

            {/* Premium Tab Navigation */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[
                        styles.tab,
                        activeTab === 'supervisors' && styles.activeTab
                    ]}
                    onPress={() => setActiveTab('supervisors')}
                    activeOpacity={0.8}
                >
                    <LinearGradient
                        colors={activeTab === 'supervisors' ? 
                            ['#8B5CF6', '#6366F1'] : 
                            ['#F8FAFC', '#F1F5F9']
                        }
                        style={styles.tabGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <Ionicons 
                            name="people" 
                            size={22} 
                            color={activeTab === 'supervisors' ? 'white' : '#8B5CF6'} 
                        />
                        <Text style={[
                            styles.tabText,
                            activeTab === 'supervisors' && styles.activeTabText
                        ]}>
                            Supervisors
                        </Text>
                    </LinearGradient>
                </TouchableOpacity>
                
                <TouchableOpacity
                    style={[
                        styles.tab,
                        activeTab === 'requests' && styles.activeTab
                    ]}
                    onPress={() => setActiveTab('requests')}
                    activeOpacity={0.8}
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
                            color={activeTab === 'requests' ? 'white' : '#8B5CF6'} 
                        />
                        <Text style={[
                            styles.tabText,
                            activeTab === 'requests' && styles.activeTabText
                        ]}>
                            My Requests
                        </Text>
                        {sentMessages.length > 0 && (
                            <View style={[
                                styles.tabBadge,
                                { backgroundColor: activeTab === 'requests' ? 'rgba(255,255,255,0.3)' : '#FF6B9C' }
                            ]}>
                                <Text style={styles.tabBadgeText}>{sentMessages.length}</Text>
                            </View>
                        )}
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#8B5CF6" />
                    <Text style={styles.loadingText}>Loading Supervisors...</Text>
                    <Text style={styles.loadingSubtext}>Preparing your communication hub</Text>
                </View>
            ) : (
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                >
                    <FlatList
                        data={activeTab === 'supervisors' ? supervisors : sentMessages}
                        keyExtractor={keyExtractor}
                        renderItem={activeTab === 'supervisors' ? renderSupervisorItem : renderMessageItem}
                        getItemLayout={activeTab === 'supervisors' ? getItemLayout : undefined}
                        initialNumToRender={8}
                        maxToRenderPerBatch={8}
                        windowSize={5}
                        removeClippedSubviews={Platform.OS === 'android'}
                        updateCellsBatchingPeriod={100}
                        ListHeaderComponent={() => (
                            <View style={styles.listHeader}>
                                <Text style={styles.sectionTitle}>
                                    {activeTab === 'supervisors' ? 'Available Supervisors' : 'Your Requests'}
                                </Text>
                                <Text style={styles.sectionSubtitle}>
                                    {activeTab === 'supervisors' 
                                        ? 'Select one to send a request' 
                                        : 'Track your communication status'
                                    }
                                </Text>
                            </View>
                        )}
                        ListEmptyComponent={() => (
                            <View style={styles.emptyContainer}>
                                <Ionicons 
                                    name={activeTab === 'supervisors' ? "people-outline" : "mail-open-outline"} 
                                    size={80} 
                                    color="#8B5CF6" 
                                />
                                <Text style={styles.emptyTitle}>
                                    {activeTab === 'supervisors' ? 'No Supervisors Available' : 'No Requests Sent Yet'}
                                </Text>
                                <Text style={styles.emptySubtitle}>
                                    {activeTab === 'supervisors' 
                                        ? 'Supervisors will appear here when available' 
                                        : 'Send your first request to get started'
                                    }
                                </Text>
                            </View>
                        )}
                        ListFooterComponent={activeTab === 'supervisors' ? renderMessageInput() : null}
                        contentContainerStyle={styles.flatListContainer}
                        extraData={selectedSupervisor}
                        showsVerticalScrollIndicator={false}
                    />
                </KeyboardAvoidingView>
            )}

            {/* Premium Dialog */}
            <Modal visible={showDialog} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <Animated.View 
                        style={[
                            styles.modalContainer,
                            { opacity: fadeAnim }
                        ]}
                    >
                        <LinearGradient
                            colors={['#8B5CF6', '#6366F1']}
                            style={styles.modalHeader}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <Ionicons
                                name={dialogMessage.includes("🎉") ? "checkmark-circle" : "alert-circle"}
                                size={48}
                                color="white"
                            />
                        </LinearGradient>
                        <View style={styles.modalBody}>
                            <Text style={styles.modalTitle}>
                                {dialogMessage.includes("🎉") ? "Success!" : "Notice"}
                            </Text>
                            <Text style={styles.modalText}>{dialogMessage}</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.modalButton}
                            onPress={() => setShowDialog(false)}
                            activeOpacity={0.9}
                        >
                            <LinearGradient
                                colors={['#8B5CF6', '#6366F1']}
                                style={styles.modalButtonGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <Text style={styles.modalButtonText}>Continue</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </Modal>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    // Premium Header
    header: {
        height: 160,
    },
    headerGradient: {
        flex: 1,
        paddingTop: 30,
        paddingHorizontal: 25,
        position: 'relative',
        overflow: 'hidden',
    },
    headerOrb1: {
        position: 'absolute',
        top: -50,
        right: -30,
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    headerOrb2: {
        position: 'absolute',
        bottom: -40,
        left: -40,
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom:90

    },
    headerIconContainer: {
        width: 60,
        height: 60,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTextContainer: {
        flex: 1,
        marginLeft: 15,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.9)',
    },
    headerBadge: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 15,
        alignItems: 'center',
    },
    headerBadgeText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 20,
    },
    headerBadgeLabel: {
        color: 'white',
        fontSize: 12,
        opacity: 0.9,
    },
    // Premium Tabs
    tabContainer: {
        flexDirection: 'row',
        marginHorizontal: 25,
        marginTop: -25,
        borderRadius: 20,
        padding: 8,
        backgroundColor: '#FFFFFF',
        shadowColor: '#8B5CF6',
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
        gap: 8,
    },
    tabText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#8B5CF6',
    },
    activeTabText: {
        color: 'white',
    },
    tabBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
        marginLeft: 8,
    },
    tabBadgeText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    // List Styles
    listHeader: {
        paddingHorizontal: 25,
        marginBottom: 20,
        marginTop: 10,
    },
    sectionTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 4,
    },
    sectionSubtitle: {
        fontSize: 16,
        color: '#64748B',
    },
    flatListContainer: {
        paddingBottom: 30,
        flexGrow: 1,
    },
    // Supervisor Items
    supervisorItemWrapper: {
        marginHorizontal: 25,
        marginBottom: 12,
    },
    supervisorItem: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.1,
        shadowRadius: 15,
        elevation: 5,
        position: 'relative',
    },
    selectedSupervisor: {
        backgroundColor: '#8B5CF6',
    },
    unavailableSupervisor: {
        opacity: 0.6,
    },
    avatarGradient: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 3,
    },
    avatarContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    supervisorInfo: {
        flex: 1,
    },
    supervisorName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 4,
    },
    supervisorSpecialty: {
        fontSize: 14,
        color: '#64748B',
        fontWeight: '600',
        marginBottom: 2,
    },
    supervisorEmail: {
        fontSize: 13,
        color: '#94A3B8',
    },
    selectedText: {
        color: 'white',
    },
    selectedIndicator: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'white',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    glowEffect: {
        position: 'absolute',
        top: -2,
        left: -2,
        right: -2,
        bottom: -2,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: '#8B5CF6',
    },
    limitedBadge: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    limitedText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#D97706',
    },
    // Message Input
    messageInputContainer: {
        marginHorizontal: 25,
        marginTop: 20,
        marginBottom: 10,
    },
    messageInputGradient: {
        borderRadius: 25,
        padding: 25,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 8,
    },
    selectedSupervisorHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    selectedAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    selectedSupervisorInfo: {
        flex: 1,
    },
    selectedName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 2,
    },
    selectedEmail: {
        fontSize: 14,
        color: '#64748B',
    },
    typingIndicator: {
        padding: 8,
        borderRadius: 10,
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
    },
    messageLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 12,
    },
    textInputContainer: {
        borderRadius: 16,
        padding: 4,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 20,
    },
    textInput: {
        minHeight: 120,
        padding: 16,
        fontSize: 16,
        color: '#1E293B',
        borderRadius: 12,
        backgroundColor: 'transparent',
        textAlignVertical: 'top',
    },
    sendButton: {
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 5,
    },
    sendButtonGradient: {
        paddingVertical: 18,
        paddingHorizontal: 24,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    sendButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    // Message Items
    messageItemWrapper: {
        marginHorizontal: 25,
        marginBottom: 12,
    },
    messageBox: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 20,
        borderLeftWidth: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.1,
        shadowRadius: 15,
        elevation: 5,
    },
    messageHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    statusIndicator: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    supervisorText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E293B',
        flex: 1,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    messageText: {
        fontSize: 15,
        color: '#475569',
        lineHeight: 22,
        marginBottom: 15,
    },
    actionButton: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    actionButtonGradient: {
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        position: 'relative',
    },
    actionButtonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 15,
    },
    unreadBadge: {
        borderRadius: 10,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FF6B9C',
    },
    unreadBadgeText: {
        color: 'white',
        fontSize: 11,
        fontWeight: 'bold',
    },
    // Loading States
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    loadingText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1E293B',
        marginTop: 16,
        marginBottom: 8,
    },
    loadingSubtext: {
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
    },
    // Empty States
    emptyContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
        marginHorizontal: 25,
        marginTop: 20,
        backgroundColor: 'white',
        borderRadius: 25,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.1,
        shadowRadius: 15,
        elevation: 5,
    },
    emptyTitle: {
        marginTop: 20,
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1E293B',
        textAlign: 'center',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 15,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 22,
    },
    // Premium Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 25,
    },
    modalContainer: {
        width: '100%',
        borderRadius: 25,
        overflow: 'hidden',
        backgroundColor: '#FFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.3,
        shadowRadius: 30,
        elevation: 15,
    },
    modalHeader: {
        padding: 30,
        alignItems: 'center',
    },
    modalBody: {
        padding: 30,
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 12,
    },
    modalText: {
        fontSize: 16,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 24,
    },
    modalButton: {
        margin: 20,
        borderRadius: 16,
        overflow: 'hidden',
    },
    modalButtonGradient: {
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
});

export default CommunicationTool;