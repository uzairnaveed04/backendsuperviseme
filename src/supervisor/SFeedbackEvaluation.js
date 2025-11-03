import React, { useEffect, useState, useCallback } from "react";
import {
    View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform,
    FlatList, ActivityIndicator, RefreshControl, TouchableOpacity, Modal,
    Pressable, Animated, Alert, Dimensions, ScrollView,
} from "react-native";
import { getAuth } from "firebase/auth";
import Ionicons from "react-native-vector-icons/Ionicons";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import * as Animatable from 'react-native-animatable';
import LinearGradient from 'react-native-linear-gradient';

const { width, height } = Dimensions.get('window');

// 🚨 IMPORTANT: Replace with your actual IP address and port
const BASE_URL = 'http://192.168.10.8:3000/api/feedback';

// Premium Color Theme
const theme = {
    primary: '#FF6B35',
    primaryDark: '#E55A2B',
    primaryLight: '#FF8C5A',
    secondary: '#FFD166',
    background: '#0F172A',
    card: '#1E293B',
    text: '#F1F5F9',
    muted: '#94A3B8',
    success: '#10B981',
    error: '#EF4444',
    star: '#FFD700',
    gradient: ['#FF6B35', '#FF8C5A'],
    darkGradient: ['#1E293B', '#334155']
};

/* --- UTILITY & ITEM COMPONENTS (ENHANCED) --- */
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
                color={i <= numRating ? theme.star : "#64748B"}
            />
        );
    }
    return <View style={{ flexDirection: "row" }}>{stars}</View>;
};

const RenderEvaluationItem = React.memo(({ item, isReceivedFeedback }) => {
    
    // Displaying Student Feedback (Received by Supervisor)
    if (isReceivedFeedback) {
        return (
            <Animatable.View 
                animation="fadeInLeft" 
                duration={600} 
                style={styles.feedbackCard}
            >
                <LinearGradient
                    colors={['#1E293B', '#334155']}
                    style={styles.cardGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <View style={styles.feedbackHeader}>
                        <View style={styles.emailContainer}>
                            <Ionicons name="person-outline" size={16} color={theme.primary} />
                            <Text style={styles.feedbackEmail}>From: {item.studentEmail}</Text>
                        </View>
                        <View style={styles.feedbackDate}>
                            <Ionicons name="time-outline" size={14} color={theme.muted} />
                            <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
                        </View>
                    </View>
                    
                    <View style={styles.ratingContainer}>
                        <Text style={styles.ratingLabel}>Student Rating:</Text>
                        {renderStarsDisplay(item.ratingByStudent)}
                    </View>
                    
                    <View style={styles.feedbackContent}>
                        <Ionicons name="chatbubble-outline" size={16} color={theme.primary} style={styles.quoteIcon} />
                        <Text style={styles.feedbackText}>
                            {item.feedbackByStudent || 'No student comments provided.'}
                        </Text>
                    </View>
                </LinearGradient>
            </Animatable.View>
        );
    }
    
    // Displaying Supervisor's Sent Evaluation (Sent by Supervisor)
    return (
        <Animatable.View 
            animation="fadeInRight" 
            duration={600} 
            style={styles.feedbackCard}
        >
            <LinearGradient
                colors={theme.gradient}
                style={styles.cardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={styles.feedbackHeader}>
                    <View style={styles.emailContainer}>
                        <Ionicons name="person-outline" size={16} color="#FFFFFF" />
                        <Text style={[styles.feedbackEmail, { color: '#FFFFFF' }]}>To: {item.studentEmail}</Text>
                    </View>
                    <View style={styles.feedbackDate}>
                        <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.8)" />
                        <Text style={[styles.dateText, { color: 'rgba(255,255,255,0.8)' }]}>{formatDate(item.createdAt)}</Text>
                    </View>
                </View>
                
                <View style={styles.ratingContainer}>
                    <Text style={[styles.ratingLabel, { color: '#FFFFFF' }]}>Grade Assigned:</Text>
                    <View style={[styles.gradeBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                        <Text style={styles.gradeText}>{item.grade || 'N/A'}</Text>
                    </View>
                </View>
                
                <View style={styles.feedbackContent}>
                    <Ionicons name="document-text-outline" size={16} color="#FFFFFF" style={styles.quoteIcon} />
                    <Text style={[styles.feedbackText, { color: '#FFFFFF' }]}>
                        {item.evaluationBySupervisor || 'No comments provided.'}
                    </Text>
                </View>
            </LinearGradient>
        </Animatable.View>
    );
});

/* --- ENHANCED HEADER/FORM COMPONENT --- */
const SupervisorFormHeader = React.memo(({
    studentEmail, setStudentEmail, evaluation, setEvaluation, grade, setGrade,
    handleSubmit, isLoading, handleClearEvaluation, isClearing
}) => {
    return (
        <View style={styles.listHeaderContainer}>
            {/* Premium Header - SEPARATE CARD */}
            <Animatable.View animation="fadeInDown" duration={800} style={styles.headerCard}>
                <LinearGradient
                    colors={theme.gradient}
                    style={styles.mainHeader}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <View style={styles.headerContent}>
                        <View style={styles.headerTextContainer}>
                            <Text style={styles.title}>Feedback Evaluation</Text>
                            <Text style={styles.subtitle}>Supervisor Panel</Text>
                        </View>
                        <View style={styles.headerIconContainer}>
                            <MaterialIcons name="assessment" size={32} color="#FFFFFF" />
                        </View>
                    </View>
                </LinearGradient>
            </Animatable.View>

            {/* Submission Form - SEPARATE CARD BELOW HEADER */}
            <Animatable.View animation="fadeInUp" delay={300} style={styles.formCard}>
                <LinearGradient
                    colors={theme.darkGradient}
                    style={styles.formGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <View style={styles.sectionHeaderContainer}>
                        <MaterialIcons name="send" size={24} color={theme.primary} />
                        <Text style={styles.sectionHeader}>Submit New Evaluation</Text>
                    </View>

                    {/* Student Email Input */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Student Email</Text>
                        <View style={styles.inputContainer}>
                            <Ionicons name="mail-outline" size={20} color={theme.primary} style={styles.inputIcon} />
                            <TextInput
                                value={studentEmail}
                                onChangeText={setStudentEmail}
                                placeholder="Enter student email"
                                placeholderTextColor={theme.muted}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                style={styles.input}
                            />
                        </View>
                    </View>
                    
                    {/* Grade Input */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Assign Grade</Text>
                        <View style={styles.inputContainer}>
                            <MaterialIcons name="grade" size={20} color={theme.primary} style={styles.inputIcon} />
                            <TextInput
                                value={grade}
                                onChangeText={setGrade}
                                placeholder="A+, B, C, etc."
                                placeholderTextColor={theme.muted}
                                autoCapitalize="characters"
                                maxLength={3}
                                style={styles.input}
                            />
                        </View>
                    </View>
                    
                    {/* Evaluation Input */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Evaluation Comments</Text>
                        <View style={[styles.inputContainer, styles.multilineContainer]}>
                            <Ionicons name="text-outline" size={20} color={theme.primary} style={styles.inputIcon} />
                            <TextInput
                                value={evaluation}
                                onChangeText={setEvaluation}
                                placeholder="Write your detailed evaluation here..."
                                placeholderTextColor={theme.muted}
                                multiline
                                numberOfLines={4}
                                style={[styles.input, styles.multilineInput]}
                            />
                        </View>
                    </View>

                    {/* Submit Button */}
                    <TouchableOpacity
                        style={styles.submitButton}
                        onPress={handleSubmit}
                        disabled={isLoading}
                    >
                        <LinearGradient
                            colors={theme.gradient}
                            style={styles.submitButtonGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <>
                                    <Text style={styles.buttonText}>Submit Evaluation</Text>
                                    <Ionicons name="send" size={20} color="#FFFFFF" style={styles.buttonIcon} />
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </LinearGradient>
            </Animatable.View>

            {/* Clear Button Section - SEPARATE CARD */}
            <Animatable.View animation="fadeInUp" delay={500} style={styles.clearCard}>
                <LinearGradient
                    colors={theme.darkGradient}
                    style={styles.formGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <TouchableOpacity
                        style={styles.clearButton}
                        onPress={handleClearEvaluation}
                        disabled={isClearing}
                    >
                        <LinearGradient
                            colors={['#EF4444', '#DC2626']}
                            style={styles.clearButtonGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            {isClearing ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <>
                                    <MaterialIcons name="delete-forever" size={20} color="#FFFFFF" />
                                    <Text style={styles.clearButtonText}>Clear All Sent Evaluations</Text>
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </LinearGradient>
            </Animatable.View>
        </View>
    );
});

/* --- MAIN SUPERVISOR COMPONENT --- */
const SupervisorFeedbackScreen = () => {
    const [studentEmail, setStudentEmail] = useState("");
    const [evaluation, setEvaluation] = useState("");
    const [grade, setGrade] = useState(""); 
    const [feedbackReceived, setFeedbackReceived] = useState([]); 
    const [evaluationsSent, setEvaluationsSent] = useState([]); 
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [successModal, setSuccessModal] = useState(false);
    const [modalMessage, setModalMessage] = useState("");
    const [isError, setIsError] = useState(false);
    const fadeAnim = useState(new Animated.Value(0))[0];
    const [supervisor, setSupervisor] = useState(null);
    const [supervisorEmail, setSupervisorEmail] = useState("");

    // Authentication
    useEffect(() => {
        const auth = getAuth();
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user && user.email) {
                setSupervisor(user);
                setSupervisorEmail(user.email.toLowerCase()); 
            } else {
                setSupervisor(null);
                setSupervisorEmail("");
                setFeedbackReceived([]);
                setEvaluationsSent([]);
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

    // API Fetch Function
    const fetchAllFeedback = useCallback(async () => {
        if (!supervisorEmail) { setLoading(false); setRefreshing(false); return; }
        setRefreshing(true); 
        if (feedbackReceived.length === 0 && evaluationsSent.length === 0) { 
            setLoading(true); 
        }

        try {
            if (!supervisor) { showMessage("Please login first", true); return; }
            const token = await supervisor.getIdToken();
            const response = await fetch(`${BASE_URL}/supervisor/${supervisorEmail}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            });

            if (response.ok) {
                const result = await response.json();
                
                const studentReceived = (result.feedbackReceived || []).filter(item => 
                    !item.supervisorDeleted 
                );
                
                const supervisorSent = (result.evaluationsSent || []).filter(item => 
                    !item.supervisorDeleted
                );
                
                setFeedbackReceived(studentReceived); 
                setEvaluationsSent(supervisorSent); 
                
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
    }, [supervisorEmail, supervisor]);

    useEffect(() => {
        if (supervisorEmail) { 
            fetchAllFeedback(); 
        } else {
            setLoading(false);
        }
    }, [fetchAllFeedback, supervisorEmail]);

    // API Submit Function
    const handleSubmit = async () => {
        if (submitting) return; 
        if (!supervisor || !studentEmail.trim() || !evaluation.trim() || !grade.trim()) {
            showMessage("Please log in and fill all evaluation fields (Student Email, Grade, and Comments)", true);
            return;
        }

        setSubmitting(true);
        try {
            const token = await supervisor.getIdToken();
            const response = await fetch(`${BASE_URL}/submit`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    studentEmail: studentEmail.trim().toLowerCase(), 
                    supervisorEmail,
                    evaluationBySupervisor: evaluation.trim(),
                    grade: grade.trim().toUpperCase(), 
                    type: 'supervisor'
                })
            });

            const result = await response.json();

            if (result.success) {
                showMessage("Evaluation submitted successfully!");
                setStudentEmail("");
                setEvaluation("");
                setGrade("");
                fetchAllFeedback(); 
            } else {
                showMessage(result.error || "Failed to submit evaluation", true);
            }
        } catch (err) {
            showMessage("Failed to submit evaluation. Network error.", true);
        } finally {
            setSubmitting(false);
        }
    };

    // Clear Evaluation Function
    const handleClearEvaluation = () => {
        const confirmMessage = "Are you sure you want to delete ALL evaluations you have SENT to students? This action will only remove the data from your view.";
        
        Alert.alert(
            "Confirm Deletion",
            confirmMessage,
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "YES, Delete Sent Evaluations", 
                    style: "destructive", 
                    onPress: () => executeClearAction(`${BASE_URL}/clear-supervisor/${supervisorEmail}`) 
                },
            ]
        );
    };

    const executeClearAction = async (endpoint) => {
        setSubmitting(true); 

        try {
            const token = await supervisor.getIdToken();
            const response = await fetch(endpoint, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });

            const result = await response.json().catch(() => ({ success: response.ok, message: "Data clear response received." }));

            if (result.success) {
                showMessage(result.message || "Sent evaluations cleared successfully!", false);
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
    
    // Consolidated List for FlatList
    const allItemsToDisplay = [];
    let currentOverallIndex = 0; 

    // 1. SECTION: Feedback Received (FROM Student)
    allItemsToDisplay.push({ 
        type: 'header', 
        title: `📥 Feedback Received (${feedbackReceived.length})`, 
        sectionId: 'received', 
        uniqueId: `header_${currentOverallIndex++}` 
    });
    if (feedbackReceived.length > 0) {
        feedbackReceived.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).forEach((item) => {
            const uniqueKey = item._id || item.id || item.feedbackId || `received_item_${item.createdAt || currentOverallIndex++}`;
            allItemsToDisplay.push({ 
                ...item, 
                type: 'received_item', 
                uniqueId: uniqueKey 
            });
        });
    } else if (!loading && supervisorEmail) {
        allItemsToDisplay.push({ type: 'empty_received', uniqueId: `empty_received_${currentOverallIndex++}` });
    }

    // 2. SECTION: Evaluations Sent (TO Student)
    allItemsToDisplay.push({ 
        type: 'header', 
        title: `📤 Evaluations Sent (${evaluationsSent.length})`, 
        sectionId: 'sent', 
        uniqueId: `header_${currentOverallIndex++}` 
    });
    if (evaluationsSent.length > 0) {
        evaluationsSent.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).forEach((item) => {
            const uniqueKey = item._id || item.id || item.feedbackId || `sent_item_${item.createdAt || currentOverallIndex++}`;
            allItemsToDisplay.push({ 
                ...item, 
                type: 'sent_item', 
                uniqueId: uniqueKey 
            });
        });
    } else if (!loading && supervisorEmail) { 
        allItemsToDisplay.push({ type: 'empty_sent', uniqueId: `empty_sent_${currentOverallIndex++}` });
    }

    const finalData = [{ type: 'form_header', uniqueId: 'form_0' }, ...allItemsToDisplay];

    // Main Render Block
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
                                <SupervisorFormHeader
                                    studentEmail={studentEmail} setStudentEmail={setStudentEmail}
                                    evaluation={evaluation} setEvaluation={setEvaluation}
                                    grade={grade} setGrade={setGrade}
                                    handleSubmit={handleSubmit}
                                    isLoading={submitting}
                                    handleClearEvaluation={handleClearEvaluation} 
                                    isClearing={submitting}
                                />
                            );
                        }
                        
                        if (item.type === 'header') {
                             return (
                                <View key={item.uniqueId} style={styles.sectionHeaderWrapper}> 
                                   <LinearGradient
                                        colors={theme.darkGradient}
                                        style={styles.sectionHeaderContainer}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                    >
                                       <Text style={styles.sectionHeader}>{item.title}</Text>
                                   </LinearGradient>
                                </View>
                             );
                        }
                        
                        if (item.type === 'sent_item' || item.type === 'received_item') {
                            const isReceivedFeedback = item.type === 'received_item'; 
                            return <RenderEvaluationItem item={item} isReceivedFeedback={isReceivedFeedback} />;
                        }

                        if (item.type.startsWith('empty_')) {
                            const message = item.type === 'empty_sent' ? 'You have not sent any evaluations yet.' : 'No student feedback received yet.';
                            return (
                                <View key={item.uniqueId} style={styles.emptyContainer}>
                                    <Ionicons name="document-outline" size={48} color={theme.muted} />
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
                            colors={[theme.primary]}
                            tintColor={theme.primary}
                        />
                    }
                    showsVerticalScrollIndicator={false}
                />
            </KeyboardAvoidingView>

            {/* Premium Modal */}
            <Modal animationType="fade" transparent={true} visible={successModal} onRequestClose={() => setSuccessModal(false)}>
                <View style={styles.centeredView}>
                    <Animatable.View animation="bounceIn" style={styles.modalView}>
                        <LinearGradient
                            colors={isError ? ['#EF4444', '#DC2626'] : theme.gradient}
                            style={styles.modalGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <View style={styles.modalHeader}>
                                {isError ? (
                                    <Ionicons name="close-circle" size={60} color="#FFFFFF" />
                                ) : (
                                    <Ionicons name="checkmark-circle" size={60} color="#FFFFFF" />
                                )}
                            </View>
                            <Text style={styles.modalText}>{modalMessage}</Text>
                            <Pressable
                                style={styles.modalButton}
                                onPress={() => setSuccessModal(false)}
                            >
                                <Text style={styles.modalButtonText}>Continue</Text>
                            </Pressable>
                        </LinearGradient>
                    </Animatable.View>
                </View>
            </Modal>
        </Animated.View>
    );
};

// Enhanced Premium Styles - FIXED SEPARATION
const styles = StyleSheet.create({
    flex: { 
        flex: 1 
    },
    flatListContent: { 
        paddingBottom: 40, 
        backgroundColor: theme.background 
    },
    
    // Header Styles - SEPARATE CARD
    listHeaderContainer: { 
        padding: 0 
    },
    headerCard: {
        marginHorizontal: 20,
        marginTop: 10,
        borderRadius: 25,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 15,
    },
    mainHeader: {
        paddingTop: 30,
        paddingBottom: 30,
        paddingHorizontal: 25,
        borderRadius: 25,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerTextContainer: {
        flex: 1,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.8)',
    },
    headerIconContainer: {
        width: 60,
        height: 60,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Form Styles - SEPARATE CARD
    formCard: {
        margin: 20,
        marginTop: 15, // Added proper margin top
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
    clearCard: {
        margin: 20,
        marginTop: 15, // Added proper margin top
        borderRadius: 25,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 15,
        elevation: 10,
    },
    sectionHeaderContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    sectionHeader: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.text,
        marginLeft: 10,
    },

    // Input Styles
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
    multilineContainer: {
        alignItems: 'flex-start',
        paddingVertical: 15,
        minHeight: 120,
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        height: 50,
        color: theme.text,
        fontSize: 16,
        paddingVertical: 0,
    },
    multilineInput: {
        height: 'auto',
        minHeight: 100,
        textAlignVertical: 'top',
        paddingTop: 8,
    },

    // Button Styles
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
    clearButton: {
        borderRadius: 15,
        overflow: 'hidden',
        marginTop: 0,
        shadowColor: theme.error,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 15,
        elevation: 8,
    },
    clearButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 15,
    },
    buttonText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 16,
        marginRight: 8,
    },
    buttonIcon: {
        marginLeft: 4,
    },
    clearButtonText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 16,
        marginLeft: 8,
    },

    // Section Headers
    sectionHeaderWrapper: { 
        paddingHorizontal: 20, 
        marginTop: 20,
        marginBottom: 10,
    },
    sectionHeaderContainer: {
        borderRadius: 15,
        padding: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    sectionHeader: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.text,
    },

    // Card Styles
    feedbackCard: {
        borderRadius: 20,
        overflow: 'hidden',
        marginHorizontal: 20,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 15,
        elevation: 6,
    },
    cardGradient: {
        padding: 20,
    },
    feedbackHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 15,
    },
    emailContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 10,
    },
    feedbackEmail: {
        fontWeight: '600',
        color: theme.text,
        fontSize: 16,
        marginLeft: 8,
        flexShrink: 1,
    },
    feedbackDate: {
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 0,
    },
    dateText: {
        color: theme.muted,
        fontSize: 12,
        marginLeft: 4,
    },
    ratingContainer: {
        marginBottom: 15,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    ratingLabel: {
        fontWeight: 'bold',
        color: theme.text,
        fontSize: 14,
    },
    gradeBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    gradeText: {
        fontWeight: 'bold',
        color: '#FFFFFF',
        fontSize: 14,
    },
    feedbackContent: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    quoteIcon: {
        marginRight: 10,
        marginTop: 2,
        flexShrink: 0,
    },
    feedbackText: {
        color: theme.text,
        lineHeight: 22,
        fontSize: 14,
        flex: 1,
    },

    // Empty State
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        marginHorizontal: 20,
        marginBottom: 15,
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

    // Modal Styles
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    modalView: {
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
    modalHeader: {
        marginBottom: 20,
    },
    modalText: {
        fontSize: 18,
        fontWeight: '600',
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
        textAlign: 'center',
        fontSize: 16,
    },
});

export default SupervisorFeedbackScreen;