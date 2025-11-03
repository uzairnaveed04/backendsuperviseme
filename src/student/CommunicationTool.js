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
    Easing,
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
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const [activeTab, setActiveTab] = useState('supervisors');

    const colors = {
        primary: '#B22222',
        secondary: '#DC143C',
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        light: '#F8FAFC',
        dark: '#1E293B',
        muted: '#94A3B8',
        card: '#FFFFFF',
        gradientStart: '#B22222',
        gradientEnd: '#DC143C',
        background: '#F1F5F9'
    };

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.out(Easing.exp),
            useNativeDriver: true,
        }).start();

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
                `http://192.168.10.8:3000/api/all-supervisors`,
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
        onSnapshot(q, (snapshot) => {
            const messages = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));
            setSentMessages(messages);

            messages.forEach((msg) => {
                if (msg.status === "Approved") {
                    const chatId = `${email}_${msg.receiverId}`;
                    const msgRef = collection(db, "chats", chatId, "messages");

                    const q2 = query(
                        msgRef,
                        where("senderId", "==", msg.receiverId),
                        where("read", "==", false)
                    );

                    onSnapshot(q2, (snapshot) => {
                        setUnreadCounts((prev) => ({
                            ...prev,
                            [msg.receiverId]: snapshot.size,
                        }));
                    });
                }
            });
        });
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
                `http://192.168.10.8:3000/api/check-supervisor/${selectedSupervisor.email}`,
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
            setDialogMessage("Request sent successfully!");
            setShowDialog(true);
            setActiveTab('requests');
        } catch (error) {
            console.error("Error sending request:", error);
            setDialogMessage("Failed to send request. Please try again.");
            setShowDialog(true);
        }
    };

    const handleSupervisorPress = useCallback((item) => {
        setSelectedSupervisor(item);
    }, []);

    const SupervisorItem = React.memo(({ item, selectedSupervisor, onSupervisorPress, setDialogMessage, setShowDialog, index }) => {
        const isSelected = selectedSupervisor?.email === item.email;
        const animValue = useRef(new Animated.Value(0)).current;

        useEffect(() => {
            Animated.timing(animValue, {
                toValue: 1,
                duration: 500,
                delay: index * 100,
                easing: Easing.out(Easing.exp),
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

        const scaleAnim = animValue.interpolate({
            inputRange: [0, 1],
            outputRange: [0.9, 1],
        });

        return (
            <Animated.View
                style={[
                    styles.supervisorItem,
                    isSelected && styles.selectedSupervisor,
                    !item.available && { opacity: 0.6 },
                    {
                        opacity: animValue,
                        transform: [
                            { scale: scaleAnim },
                            {
                                translateY: animValue.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [50, 0],
                                }),
                            },
                        ],
                    },
                ]}
            >
                <TouchableOpacity
                    style={styles.supervisorContent}
                    onPress={handlePress}
                    activeOpacity={0.7}
                >
                    <LinearGradient
                        colors={
                            isSelected
                                ? [colors.primary, colors.secondary]
                                : ['#FFFFFF', '#F8FAFC']
                        }
                        style={styles.avatarContainer}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <Ionicons
                            name={item.avatar || "person"}
                            size={28}
                            color={isSelected ? colors.card : colors.primary}
                        />
                    </LinearGradient>

                    <View style={styles.supervisorInfo}>
                        <Text style={[styles.supervisorName, isSelected && { color: colors.card }]}>
                            {item.name}
                        </Text>
                        <Text style={[styles.supervisorSpecialty, isSelected && { color: colors.card }]}>
                            {item.specialty}
                        </Text>
                        <Text style={[styles.supervisorEmail, isSelected && { color: colors.card }]}>
                            {item.email}
                        </Text>
                    </View>

                    {isSelected && (
                        <View style={[styles.selectedIndicator, { backgroundColor: colors.card }]}>
                            <Ionicons name="checkmark" size={20} color={colors.primary} />
                        </View>
                    )}

                    {!item.available && (
                        <View style={styles.limitedBadge}>
                            <Text style={styles.limitedText}>Limited</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </Animated.View>
        );
    });

    const renderSupervisorItem = useCallback(({ item, index }) => (
        <SupervisorItem
            item={item}
            index={index}
            selectedSupervisor={selectedSupervisor}
            onSupervisorPress={handleSupervisorPress}
            setDialogMessage={setDialogMessage}
            setShowDialog={setShowDialog}
        />
    ), [selectedSupervisor, handleSupervisorPress]);

    const renderMessageItem = ({ item, index }) => {
        const translateY = new Animated.Value(50);
        const opacity = new Animated.Value(0);

        Animated.parallel([
            Animated.timing(translateY, {
                toValue: 0,
                duration: 500,
                delay: index * 100,
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 1,
                duration: 500,
                delay: index * 100,
                useNativeDriver: true,
            }),
        ]).start();

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
                    styles.messageBox,
                    {
                        opacity,
                        transform: [{ translateY }],
                        borderLeftWidth: 6,
                        borderLeftColor: statusColors[item.status]
                    },
                ]}
            >
                <TouchableOpacity
                    onPress={() => {
                        if (item.status === "Approved") {
                            navigation.navigate("ChatsScreen", {
                                studentId: studentEmail,
                                supervisorId: item.receiverId,
                            });
                        } else if (item.status === "Rejected") {
                            setSelectedSupervisor(supervisors.find(s => s.email === item.receiverId));
                            setActiveTab('supervisors');
                        }
                    }}
                    style={{ paddingBottom: item.status !== "Approved" && item.status !== "Rejected" ? 0 : 10 }}
                    activeOpacity={0.7}
                >
                    <View style={styles.messageHeader}>
                        <View style={[styles.statusIndicator, { backgroundColor: statusColors[item.status] }]}>
                            <Ionicons
                                name={statusIcons[item.status]}
                                size={16}
                                color="white"
                            />
                        </View>
                        <Text style={styles.supervisorText}>To: {item.receiverId.split('@')[0]}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: statusColors[item.status] + '20' }]}>
                            <Text style={[styles.statusText, { color: statusColors[item.status] }]}>
                                {item.status}
                            </Text>
                        </View>
                    </View>

                    <Text style={styles.messageText}>{item.message}</Text>
                </TouchableOpacity>

                {item.status === "Approved" && (
                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: colors.success }]}
                        onPress={() =>
                            navigation.navigate("ChatsScreen", {
                                studentId: studentEmail,
                                supervisorId: item.receiverId,
                            })
                        }
                        activeOpacity={0.8}
                    >
                        <Ionicons name="chatbubbles" size={18} color="white" />
                        <Text style={styles.actionButtonText}>Open Chat</Text>
                        {unreadCounts[item.receiverId] > 0 && (
                            <View style={[styles.unreadBadge, { backgroundColor: colors.secondary }]}>
                                <Text style={styles.unreadBadgeText}>
                                    {unreadCounts[item.receiverId]}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                )}

                {item.status === "Rejected" && (
                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: colors.muted }]}
                        onPress={() => {
                            setSelectedSupervisor(supervisors.find(s => s.email === item.receiverId));
                            setActiveTab('supervisors');
                        }}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="refresh" size={18} color="white" />
                        <Text style={styles.actionButtonText}>Try Another Supervisor</Text>
                    </TouchableOpacity>
                )}
            </Animated.View>
        );
    };

    const renderMessageInput = () => {
        if (!selectedSupervisor) return null;
        return (
            <View style={styles.messageInputContainer}>
                <View style={styles.selectedSupervisorHeader}>
                    <LinearGradient
                        colors={[colors.primary + '20', colors.secondary + '20']}
                        style={styles.selectedAvatar}
                    >
                        <Ionicons name="person" size={24} color={colors.primary} />
                    </LinearGradient>
                    <View>
                        <Text style={styles.selectedName}>{selectedSupervisor.name}</Text>
                        <Text style={styles.selectedEmail}>{selectedSupervisor.email}</Text>
                    </View>
                </View>
                
                <Text style={styles.messageLabel}>
                    Your Request Message
                </Text>
                <TextInput
                    value={message}
                    onChangeText={setMessage}
                    placeholder="Write your request message here..."
                    placeholderTextColor={colors.muted}
                    style={styles.textInput}
                    multiline
                    textAlignVertical="top"
                />
                <TouchableOpacity
                    style={styles.sendButton}
                    onPress={sendRequest}
                    activeOpacity={0.9}
                >
                    <LinearGradient
                        colors={[colors.primary, colors.secondary]}
                        style={styles.gradientButton}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                    >
                        <Ionicons name="send" size={20} color="white" />
                        <Text style={styles.sendButtonText}>Send Request</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        // SafeAreaView commented out temporarily
        // <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
                {/* Header */}
                <LinearGradient
                    colors={[colors.primary, colors.secondary]}
                    style={styles.header}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                >
                    <View style={styles.headerContent}>
                        <View style={styles.headerIcon}>
                            <Ionicons name="chatbox-ellipses" size={28} color="white" />
                        </View>
                        <View>
                            <Text style={styles.headerTitle}>Communication Tool</Text>
                            <Text style={styles.headerSubtitle}>Connect with supervisors</Text>
                        </View>
                    </View>
                </LinearGradient>

                {/* Tab Navigation */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[
                            styles.tabButton,
                            activeTab === 'supervisors' && styles.activeTab
                        ]}
                        onPress={() => setActiveTab('supervisors')}
                        activeOpacity={0.7}
                    >
                        <Ionicons 
                            name="people" 
                            size={20} 
                            color={activeTab === 'supervisors' ? colors.primary : colors.muted} 
                        />
                        <Text style={[
                            styles.tabText,
                            activeTab === 'supervisors' && styles.activeTabText
                        ]}>
                            Supervisors
                        </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                        style={[
                            styles.tabButton,
                            activeTab === 'requests' && styles.activeTab
                        ]}
                        onPress={() => setActiveTab('requests')}
                        activeOpacity={0.7}
                    >
                        <Ionicons 
                            name="document-text" 
                            size={20} 
                            color={activeTab === 'requests' ? colors.primary : colors.muted} 
                        />
                        <Text style={[
                            styles.tabText,
                            activeTab === 'requests' && styles.activeTabText
                        ]}>
                            My Requests
                        </Text>
                        {sentMessages.length > 0 && (
                            <View style={[styles.tabBadge, { backgroundColor: colors.primary }]}>
                                <Text style={styles.tabBadgeText}>{sentMessages.length}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.loadingText}>Loading supervisors...</Text>
                    </View>
                ) : (
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={{ flex: 1 }}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
                    >
                        <FlatList
                            data={activeTab === 'supervisors' ? supervisors : sentMessages}
                            keyExtractor={(item) => item.id || item.email}
                            renderItem={activeTab === 'supervisors' ? renderSupervisorItem : renderMessageItem}
                            ListHeaderComponent={() => (
                                <View style={styles.listHeader}>
                                    <Text style={styles.sectionTitle}>
                                        {activeTab === 'supervisors' ? 'Available Supervisors' : 'Your Requests'}
                                    </Text>
                                    <Text style={styles.sectionSubtitle}>
                                        {activeTab === 'supervisors' ? 'Select one to send a request' : 'Status of your sent requests'}
                                    </Text>
                                </View>
                            )}
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <Ionicons 
                                        name={activeTab === 'supervisors' ? "people-outline" : "mail-open-outline"} 
                                        size={64} 
                                        color={colors.muted} 
                                    />
                                    <Text style={styles.emptyTitle}>
                                        {activeTab === 'supervisors' ? 'No supervisors available' : 'No requests sent yet'}
                                    </Text>
                                    <Text style={styles.emptySubtitle}>
                                        {activeTab === 'supervisors' 
                                            ? 'Check back later for available supervisors' 
                                            : 'Send a request to a supervisor to get started'
                                        }
                                    </Text>
                                    {activeTab === 'requests' && (
                                        <TouchableOpacity
                                            style={styles.primaryButton}
                                            onPress={() => setActiveTab('supervisors')}
                                            activeOpacity={0.8}
                                        >
                                            <LinearGradient
                                                colors={[colors.primary, colors.secondary]}
                                                style={styles.primaryButtonGradient}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 0 }}
                                            >
                                                <Ionicons name="search" size={20} color="white" />
                                                <Text style={styles.primaryButtonText}>Find a Supervisor</Text>
                                            </LinearGradient>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            }
                            ListFooterComponent={activeTab === 'supervisors' ? renderMessageInput() : null}
                            contentContainerStyle={styles.flatListContainer}
                            extraData={selectedSupervisor}
                            showsVerticalScrollIndicator={false}
                        />
                    </KeyboardAvoidingView>
                )}

                {/* Dialog Modal */}
                <Modal visible={showDialog} transparent animationType="fade">
                    <View style={styles.modalOverlay}>
                        <Animated.View style={[styles.modalContainer, {
                            transform: [{
                                scale: fadeAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0.9, 1]
                                })
                            }]
                        }]}>
                            <View style={styles.modalIcon}>
                                <Ionicons
                                    name={dialogMessage.includes("successfully") ? "checkmark-circle" : "alert-circle"}
                                    size={48}
                                    color={dialogMessage.includes("successfully") ? colors.success : colors.danger}
                                />
                            </View>
                            <Text style={styles.modalText}>{dialogMessage}</Text>
                            <TouchableOpacity
                                style={styles.modalButton}
                                onPress={() => setShowDialog(false)}
                                activeOpacity={0.8}
                            >
                                <LinearGradient
                                    colors={[colors.primary, colors.secondary]}
                                    style={styles.modalButtonGradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                >
                                    <Text style={styles.modalButtonText}>Got it!</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </Animated.View>
                    </View>
                </Modal>
            </Animated.View>
        // </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        paddingTop: 35
    },
    header: {
        paddingVertical: 24,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerIcon: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: 'white',
        letterSpacing: 0.5,
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 2,
        fontWeight: '500',
    },
    tabContainer: {
        flexDirection: 'row',
        marginHorizontal: 20,
        marginVertical: 20,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    tabButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        gap: 8,
    },
    activeTab: {
        backgroundColor: '#F8FAFC',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    tabText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#94A3B8',
    },
    activeTabText: {
        color: '#B22222',
    },
    tabBadge: {
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 2,
        minWidth: 20,
        alignItems: 'center',
    },
    tabBadgeText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    listHeader: {
        paddingHorizontal: 20,
        marginTop: 10,
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#1E293B',
        marginBottom: 4,
    },
    sectionSubtitle: {
        fontSize: 15,
        color: '#64748B',
        fontWeight: '500',
    },
    flatListContainer: {
        paddingBottom: 30,
        flexGrow: 1,
    },
    supervisorItem: {
        backgroundColor: 'white',
        borderRadius: 20,
        marginHorizontal: 20,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 4,
        overflow: 'hidden',
    },
    selectedSupervisor: {
        borderWidth: 2,
        borderColor: '#B22222',
        backgroundColor: '#B22222',
    },
    supervisorContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        position: 'relative',
    },
    avatarContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    supervisorInfo: {
        flex: 1,
    },
    supervisorName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 2,
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
    selectedIndicator: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    limitedBadge: {
        position: 'absolute',
        top: 12,
        right: 12,
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    limitedText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#D97706',
    },
    messageInputContainer: {
        backgroundColor: 'white',
        borderRadius: 20,
        margin: 20,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
        marginTop: 10,
    },
    selectedSupervisorHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    selectedAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    selectedName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1E293B',
    },
    selectedEmail: {
        fontSize: 13,
        color: '#64748B',
        marginTop: 2,
    },
    messageLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1E293B',
        marginBottom: 8,
    },
    textInput: {
        minHeight: 100,
        borderWidth: 1.5,
        borderColor: "#E2E8F0",
        borderRadius: 16,
        padding: 16,
        fontSize: 15,
        color: '#1E293B',
        textAlignVertical: "top",
        backgroundColor: '#F8FAFC',
    },
    sendButton: {
        borderRadius: 16,
        marginTop: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 4,
    },
    gradientButton: {
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    sendButtonText: {
        color: 'white',
        fontWeight: '700',
        fontSize: 16,
    },
    messageBox: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 20,
        marginHorizontal: 20,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 4,
    },
    messageHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    statusIndicator: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    supervisorText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1E293B',
        flex: 1,
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 13,
        fontWeight: '700',
    },
    messageText: {
        fontSize: 15,
        color: '#475569',
        lineHeight: 22,
        marginBottom: 12,
    },
    actionButton: {
        padding: 14,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        gap: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    actionButtonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 15,
    },
    unreadBadge: {
        position: 'absolute',
        top: -6,
        right: -6,
        borderRadius: 10,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    unreadBadgeText: {
        color: 'white',
        fontSize: 11,
        fontWeight: 'bold',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#64748B',
        fontWeight: '500',
    },
    emptyContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
        marginHorizontal: 20,
        marginTop: 20,
        backgroundColor: 'white',
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    emptyTitle: {
        marginTop: 16,
        fontSize: 18,
        color: '#1E293B',
        fontWeight: '700',
        textAlign: 'center',
    },
    emptySubtitle: {
        marginTop: 8,
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 20,
    },
    primaryButton: {
        borderRadius: 16,
        marginTop: 20,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 4,
    },
    primaryButtonGradient: {
        paddingVertical: 14,
        paddingHorizontal: 24,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    primaryButtonText: {
        color: 'white',
        fontWeight: '700',
        fontSize: 15,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        backgroundColor: 'white',
        borderRadius: 24,
        padding: 24,
        width: '100%',
        maxWidth: 320,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    modalIcon: {
        marginBottom: 16,
    },
    modalText: {
        fontSize: 16,
        color: '#374151',
        textAlign: 'center',
        marginVertical: 16,
        lineHeight: 24,
        fontWeight: '500',
    },
    modalButton: {
        borderRadius: 16,
        marginTop: 8,
        overflow: 'hidden',
        width: '100%',
    },
    modalButtonGradient: {
        paddingVertical: 14,
        paddingHorizontal: 24,
        alignItems: 'center',
    },
    modalButtonText: {
        color: 'white',
        fontWeight: '700',
        fontSize: 16,
    },
});

export default CommunicationTool;