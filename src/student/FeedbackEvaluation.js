import React, { useEffect, useState, useCallback } from "react";
import {
    View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform,
    FlatList, ActivityIndicator, RefreshControl, TouchableOpacity, Modal,
    Pressable, Animated, Alert,
} from "react-native";
import { getAuth } from "firebase/auth";
import Ionicons from "react-native-vector-icons/Ionicons";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import * as Animatable from 'react-native-animatable';

// 🚨 IMPORTANT: Replace with your actual IP address and port
const BASE_URL = 'http://192.168.10.8:3000/api/feedback';

const theme = {
    primary: '#007AFF',
    secondary: '#5AC8FA',
    background: '#f0f2f5',
    card: 'white',
    text: '#2c3e50',
    muted: '#888',
    success: '#4CAF50',
    error: '#e74c3c',
    warning: '#FF9800',
    star: '#FFD700'
};

/* --- UTILITY & ITEM COMPONENTS (UNCHANGED) --- */
const formatDate = (dateValue) => {
    try {
        if (!dateValue) return 'No date';
        const date = (typeof dateValue === 'string') ? new Date(dateValue) : new Date(dateValue);
        return isNaN(date.getTime()) ? 'Invalid date' : date.toLocaleDateString();
    } catch (error) {
        return 'Invalid date';
    }
};

const renderStarsDisplay = (rating) => {
    const stars = [];
    const numRating = parseInt(rating) || 0;
    for (let i = 1; i <= 5; i++) {
        stars.push(
            <MaterialIcons
                key={i}
                name={i <= numRating ? "star" : "star-border"}
                size={20}
                color={i <= numRating ? theme.star : "#ccc"}
            />
        );
    }
    return <View style={{ flexDirection: "row" }}>{stars}</View>;
};

const RenderFeedbackItem = React.memo(({ item, isEvaluation }) => {
    // Displaying Supervisor Evaluation (Received by Student)
    if (isEvaluation) {
        return (
            <Animatable.View animation="fadeInRight" duration={500} style={[styles.feedbackCard, { borderColor: theme.secondary, borderWidth: 1 }]}>
                <View style={styles.feedbackHeader}>
                    <Text style={styles.feedbackEmail}>From: {item.supervisorEmail}</Text>
                    <View style={styles.feedbackDate}>
                        <Ionicons name="time-outline" size={14} color="#666" />
                        <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
                    </View>
                </View>
                <View style={styles.ratingContainer}>
                    <Text style={{ fontWeight: 'bold', color: theme.text }}>Grade:</Text>
                    <Text style={[styles.gradeText, { backgroundColor: theme.primary }]}>{item.grade || 'N/A'}</Text>
                </View>
                <Text style={styles.feedbackText}>"{item.evaluationBySupervisor || 'No comments provided.'}"</Text>
            </Animatable.View>
        );
    }
    
    // Displaying Student's Sent Feedback (Sent by Student)
    return (
        <Animatable.View animation="fadeInLeft" duration={500} style={styles.feedbackCard}>
            <View style={styles.feedbackHeader}>
                <Text style={styles.feedbackEmail}>To: {item.supervisorEmail}</Text>
                <View style={styles.feedbackDate}>
                    <Ionicons name="time-outline" size={14} color="#666" />
                    <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
                </View>
            </View>
            <View style={styles.ratingContainer}>
                <Text style={{ color: theme.text, marginRight: 8 }}>Rating:</Text>
                {renderStarsDisplay(item.ratingByStudent)}
            </View>
            <Text style={styles.feedbackText}>"{item.feedbackByStudent}"</Text>
        </Animatable.View>
    );
});

/* --- HEADER/FORM COMPONENT (UNCHANGED) --- */
const StudentFormHeader = React.memo(({
    supervisorEmail, setSupervisorEmail, feedback, setFeedback, rating, setRating,
    handleSubmit, isLoading, handleClearFeedback, isClearing
}) => {
    const renderRatingIcons = () => {
        const icons = [];
        for (let i = 1; i <= 5; i++) {
            icons.push(
                <TouchableOpacity key={i} onPress={() => setRating(i)}>
                    <MaterialIcons
                        name={i <= rating ? "star" : "star-border"}
                        size={30}
                        color={i <= rating ? theme.star : "#ccc"}
                        style={{ marginHorizontal: 3 }}
                    />
                </TouchableOpacity>
            );
        }
        return <View style={{ flexDirection: 'row', justifyContent: 'center', marginVertical: 10 }}>{icons}</View>;
    };

    return (
        <View style={styles.listHeaderContainer}>
            <Animatable.View animation="fadeInDown" duration={800}>
                <View style={styles.header}>
                    <Text style={styles.title}>Student Feedback Panel</Text>
                    <Ionicons name="chatbubbles-outline" size={24} color={theme.primary} />
                </View>
            </Animatable.View>

            <Animatable.View animation="fadeInUp" delay={300} style={styles.card}>
                <Text style={styles.sectionHeader}>Submit Feedback to Supervisor</Text>

                <View style={styles.inputContainer}>
                    <Ionicons name="mail-outline" style={styles.inputIcon} />
                    <TextInput
                        value={supervisorEmail}
                        onChangeText={setSupervisorEmail}
                        placeholder="Supervisor Email"
                        placeholderTextColor={theme.muted}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        style={styles.input}
                    />
                </View>
                
                <Text style={styles.label}>Rate Your Experience:</Text>
                {renderRatingIcons()}

                <View style={styles.inputContainer}>
                    <Ionicons name="text-outline" style={styles.inputIcon} />
                    <TextInput
                        value={feedback}
                        onChangeText={setFeedback}
                        placeholder="Your detailed feedback..."
                        placeholderTextColor={theme.muted}
                        multiline
                        numberOfLines={4}
                        style={[styles.input, styles.multilineInput]}
                    />
                </View>

                <TouchableOpacity
                    style={[styles.submitButton, { backgroundColor: theme.primary }]}
                    onPress={handleSubmit}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <>
                            <Text style={styles.buttonText}>Submit Feedback</Text>
                            <Ionicons name="send" size={18} color="white" />
                        </>
                    )}
                </TouchableOpacity>
            </Animatable.View>

            <Animatable.View animation="fadeInUp" delay={500} style={[styles.card, { marginTop: 10 }]}>
                <Text style={styles.sectionHeader}>Data Management</Text>
                <TouchableOpacity
                    style={[styles.clearButton, { borderColor: theme.error, backgroundColor: 'transparent' }]}
                    onPress={handleClearFeedback}
                    disabled={isClearing}
                >
                    <MaterialIcons name="delete-forever" size={20} color={theme.error} />
                    <Text style={[styles.buttonText, { color: theme.error, marginLeft: 10 }]}>
                        {isClearing ? 'Clearing...' : 'Clear My Sent Feedback'}
                    </Text>
                </TouchableOpacity>
            </Animatable.View>
        </View>
    );
});


/* --- MAIN STUDENT COMPONENT (FETCH LOGIC IS CORRECT) --- */
const StudentFeedbackScreen = () => {
    const [supervisorEmail, setSupervisorEmail] = useState("");
    const [feedback, setFeedback] = useState("");
    const [rating, setRating] = useState(0); 
    const [feedbackSent, setFeedbackSent] = useState([]); 
    const [evaluationsReceived, setEvaluationsReceived] = useState([]); 
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [successModal, setSuccessModal] = useState(false);
    const [modalMessage, setModalMessage] = useState("");
    const [isError, setIsError] = useState(false);
    const fadeAnim = useState(new Animated.Value(0))[0];
    const [student, setStudent] = useState(null);
    const [studentEmail, setStudentEmail] = useState("");

    // --- Authentication (UNCHANGED) ---
    useEffect(() => {
        const auth = getAuth();
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user && user.email) {
                setStudent(user);
                setStudentEmail(user.email.toLowerCase()); 
            } else {
                setStudent(null);
                setStudentEmail("");
                setLoading(false);
            }
        });
        Animated.timing(fadeAnim, { toValue: 1, duration: 1000, useNativeDriver: true }).start();
        return () => unsubscribe();
    }, [fadeAnim]);

    const showMessage = (message, error = false) => {
        setModalMessage(message);
        setIsError(error);
        setSuccessModal(true);
    };

    // --- API Fetch Function (Filtering is correct for Student view) ---
    const fetchAllFeedback = useCallback(async () => {
        if (!studentEmail) { setLoading(false); setRefreshing(false); return; }
        setRefreshing(true); 
        if (feedbackSent.length === 0 && evaluationsReceived.length === 0) { 
            setLoading(true); 
        }

        try {
            if (!student) { showMessage("Please login first", true); return; }
            const token = await student.getIdToken();
            const response = await fetch(`${BASE_URL}/student/${studentEmail}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            });

            if (response.ok) {
                const result = await response.json();
                
                // 1. Student's SENT Feedback: Filter out items marked as 'studentDeleted' (their own delete)
                const studentSent = (result.feedbackSent || []).filter(item => 
                    !item.studentDeleted
                );
                
                // 2. Supervisor's Evaluation RECEIVED: Filter out items marked as 'supervisorDeleted' (if supervisor deletes, student won't see it)
                const supervisorReceived = (result.evaluationsReceived || []).filter(item => 
                    !item.supervisorDeleted
                );
                
                setFeedbackSent(studentSent); 
                setEvaluationsReceived(supervisorReceived); 
                
            } else {
                const errorResult = await response.json().catch(() => ({ error: 'Unknown fetch error' }));
                showMessage(errorResult.error || `Error fetching feedback (Status: ${response.status})`, true);
            }
        } catch (err) {
            console.error("Fetch Error:", err);
            showMessage(`Network or Server Error: ${err.message}`, true);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [studentEmail, student]); 

    useEffect(() => {
        if (studentEmail) { 
            fetchAllFeedback(); 
        } else {
            setLoading(false);
        }
    }, [fetchAllFeedback, studentEmail]);

    // --- API Submit Function (UNCHANGED) ---
    const handleSubmit = async () => {
        if (submitting) return; 
        if (!student || !supervisorEmail.trim() || !feedback.trim() || rating === 0) {
            showMessage("Please log in, select a rating, and fill all fields", true);
            return;
        }

        setSubmitting(true);
        try {
            const token = await student.getIdToken();
            const response = await fetch(`${BASE_URL}/submit`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    studentEmail,
                    supervisorEmail: supervisorEmail.trim().toLowerCase(), 
                    feedbackByStudent: feedback.trim(),
                    ratingByStudent: rating.toString(), 
                    type: 'student'
                })
            });

            const result = await response.json();

            if (result.success) {
                showMessage("Feedback submitted successfully!");
                setSupervisorEmail("");
                setFeedback("");
                setRating(0);
                fetchAllFeedback(); 
            } else {
                showMessage(result.error || "Failed to submit feedback", true);
            }
        } catch (err) {
            showMessage("Failed to submit feedback. Network error.", true);
        } finally {
            setSubmitting(false);
        }
    };

    // --- Clear Feedback Function (UNCHANGED) ---
    const handleClearFeedback = () => {
        const confirmMessage = "Are you sure you want to delete ALL feedback you have SENT to supervisors? This action will only remove the data from your view.";
        
        Alert.alert(
            "Confirm Deletion",
            confirmMessage,
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "YES, Delete Sent Feedback", 
                    style: "destructive", 
                    onPress: () => executeClearAction(`${BASE_URL}/clear-student/${studentEmail}`) 
                },
            ]
        );
    };

    const executeClearAction = async (endpoint) => {
        setSubmitting(true); 

        try {
            const token = await student.getIdToken();
            const response = await fetch(endpoint, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });

            const result = await response.json().catch(() => ({ success: response.ok, message: "Data clear response received." }));

            if (result.success) {
                showMessage(result.message || "Sent feedback cleared successfully!", false);
                fetchAllFeedback(); 
            } else {
                showMessage(result.error || "Failed to clear data", true);
            }
        } catch (err) {
            showMessage(`Failed to clear data. Network error: ${err.message}`, true);
        } finally {
            setSubmitting(false);
        }
    };
    
    // --- CONSOLIDATED LIST FOR FLATLIST (UNCHANGED) ---
    const allItemsToDisplay = [];
    let currentOverallIndex = 0; 

    // 1. SECTION: Evaluations Received (FROM Supervisor)
    allItemsToDisplay.push({ 
        type: 'header', 
        title: `Evaluations Received (${evaluationsReceived.length})`, 
        sectionId: 'received', 
        uniqueId: `header_${currentOverallIndex++}` 
    });
    if (evaluationsReceived.length > 0) {
        evaluationsReceived.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).forEach((item) => {
            const uniqueKey = item._id || item.id || item.feedbackId || `received_item_${item.createdAt || currentOverallIndex++}`;
            allItemsToDisplay.push({ 
                ...item, 
                type: 'received_item', 
                uniqueId: uniqueKey 
            });
        });
    } else if (!loading && studentEmail) {
        allItemsToDisplay.push({ type: 'empty_received', uniqueId: `empty_received_${currentOverallIndex++}` });
    }

    // 2. SECTION: Feedback Sent (TO Supervisor)
    allItemsToDisplay.push({ 
        type: 'header', 
        title: `Feedback Sent (${feedbackSent.length})`, 
        sectionId: 'sent', 
        uniqueId: `header_${currentOverallIndex++}` 
    });
    if (feedbackSent.length > 0) {
        feedbackSent.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).forEach((item) => {
            const uniqueKey = item._id || item.id || item.feedbackId || `sent_item_${item.createdAt || currentOverallIndex++}`;
            allItemsToDisplay.push({ 
                ...item, 
                type: 'sent_item', 
                uniqueId: uniqueKey 
            });
        });
    } else if (!loading && studentEmail) { 
        allItemsToDisplay.push({ type: 'empty_sent', uniqueId: `empty_sent_${currentOverallIndex++}` });
    }

    const finalData = [{ type: 'form_header', uniqueId: 'form_0' }, ...allItemsToDisplay];

    // --- MAIN RENDER BLOCK (UNCHANGED) ---
    return (
        <Animated.View style={[styles.flex, { opacity: fadeAnim, backgroundColor: theme.background }]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.flex}
            >
                <FlatList
                    data={finalData}
                    keyExtractor={(item) => item.uniqueId} 
                    renderItem={({ item }) => {
                        if (item.type === 'form_header') {
                            return (
                                <StudentFormHeader
                                    supervisorEmail={supervisorEmail} setSupervisorEmail={setSupervisorEmail}
                                    feedback={feedback} setFeedback={setFeedback}
                                    rating={rating} setRating={setRating}
                                    handleSubmit={handleSubmit}
                                    isLoading={submitting}
                                    handleClearFeedback={handleClearFeedback} 
                                    isClearing={submitting}
                                />
                            );
                        }
                        
                        if (item.type === 'header') {
                             return (
                                <View key={item.uniqueId} style={styles.sectionHeaderWrapper}> 
                                   <View style={[styles.sectionHeaderContainer, { marginTop: item.sectionId === 'received' ? 0 : 20 }]}>
                                       <Text style={styles.sectionHeader}>{item.title}</Text>
                                   </View>
                                </View>
                             );
                        }
                        
                        if (item.type === 'sent_item' || item.type === 'received_item') {
                            const isEvaluation = item.type === 'received_item'; 
                            return <RenderFeedbackItem item={item} isEvaluation={isEvaluation} />;
                        }

                        if (item.type.startsWith('empty_')) {
                            const message = item.type === 'empty_sent' ? 'You have not sent any feedback yet.' : 'No supervisor evaluations received yet.';
                            return (
                                <View key={item.uniqueId} style={styles.emptyContainer}>
                                    <Ionicons name="sad-outline" size={48} color="#ccc" />
                                    <Text style={styles.emptyText}>{message}</Text>
                                </View>
                            );
                        }

                        return null;
                    }}
                    ListFooterComponent={<View style={{ height: 40 }} />}
                    contentContainerStyle={styles.flatListContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={fetchAllFeedback}
                            tintColor={theme.primary}
                        />
                    }
                />
            </KeyboardAvoidingView>

            {/* --- Modals (Success/Error) (UNCHANGED) --- */}
            <Modal animationType="fade" transparent={true} visible={successModal} onRequestClose={() => setSuccessModal(false)}>
                <View style={styles.centeredView}>
                    <Animatable.View animation="bounceIn" style={styles.modalView}>
                        <View style={styles.modalHeader}>
                            {isError ? (<Ionicons name="close-circle" size={48} color={theme.error} />) : (<Ionicons name="checkmark-circle" size={48} color={theme.success} />)}
                        </View>
                        <Text style={styles.modalText}>{modalMessage}</Text>
                        <Pressable
                            style={[ styles.modalButton, isError ? styles.errorButton : styles.successButton ]}
                            onPress={() => setSuccessModal(false)}
                        >
                            <Text style={styles.modalButtonText}>OK</Text>
                        </Pressable>
                    </Animatable.View>
                </View>
            </Modal>
        </Animated.View>
    );
};

// --- STYLES (UNCHANGED) ---
const styles = StyleSheet.create({
    flex: { flex: 1 },
    flatListContent: { paddingBottom: 40, backgroundColor: "#f0f2f5" },
    listHeaderContainer: { padding: 20, paddingTop: 50 },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 20, paddingHorizontal: 10, marginBottom: 20 },
    title: { fontSize: 24, fontWeight: "700", color: "#2c3e50", marginRight: 10 },
    card: { backgroundColor: "white", borderRadius: 12, padding: 20, marginBottom: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3 },
    
    inputContainer: { flexDirection: "row", alignItems: "center", marginBottom: 15, borderWidth: 1, borderColor: "#ddd", borderRadius: 8, paddingHorizontal: 10 },
    inputIcon: { fontSize: 20, color: theme.primary, marginRight: 10 },
    input: { flex: 1, height: 50, color: "#333", fontSize: 16 },
    multilineInput: { height: 100, textAlignVertical: "top", paddingVertical: 15 },
    label: { fontSize: 14, fontWeight: '600', color: theme.text, marginBottom: 5, textAlign: 'center' },

    submitButton: { backgroundColor: theme.primary, borderRadius: 8, padding: 15, flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 10, shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 5 },
    buttonText: { color: "white", fontWeight: "600", fontSize: 16, marginRight: 10 },
    
    sectionHeaderWrapper: { paddingHorizontal: 20, marginTop: 10 },
    sectionHeaderContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15, paddingRight: 5 },
    sectionHeader: { fontSize: 18, fontWeight: "700", color: "#2c3e50" },
    
    feedbackCard: { backgroundColor: "white", borderRadius: 12, padding: 16, marginHorizontal: 20, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
    feedbackHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
    feedbackEmail: { fontWeight: "600", color: "#2c3e50", fontSize: 15 },
    feedbackDate: { flexDirection: "row", alignItems: "center" },
    dateText: { color: "#666", fontSize: 12, marginLeft: 4 },
    ratingContainer: { marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
    feedbackText: { color: "#555", lineHeight: 20, fontStyle: 'italic' },
    
    gradeText: { fontWeight: '700', color: 'white', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 5, marginLeft: 10, minWidth: 40, textAlign: 'center' },
    
    emptyContainer: { alignItems: "center", justifyContent: "center", padding: 40, marginHorizontal: 20, marginBottom: 12, backgroundColor: 'white', borderRadius: 12 },
    emptyText: { color: "#888", fontSize: 16, marginTop: 10 },
    
    clearButton: { 
        flexDirection: "row", 
        justifyContent: "center", 
        alignItems: "center", 
        marginTop: 15, 
        padding: 12, 
        borderRadius: 8, 
        borderWidth: 1.5,
    },
    centeredView: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" },
    modalView: { backgroundColor: "white", borderRadius: 20, padding: 25, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5, width: "80%" },
    modalHeader: { marginBottom: 15 },
    modalText: { fontSize: 18, fontWeight: "600", textAlign: "center", marginBottom: 20, color: "#2c3e50" },
    modalButton: { 
        borderRadius: 8, 
        padding: 12, 
        elevation: 2, 
        minWidth: '45%', 
        marginHorizontal: 5
    },
    successButton: { backgroundColor: theme.success },
    errorButton: { backgroundColor: theme.error },
    modalButtonText: { color: "white", fontWeight: "bold", textAlign: "center" },
});

export default StudentFeedbackScreen;