import React, { useEffect, useState, useCallback } from "react";
import {
    View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform,
    FlatList, ActivityIndicator, RefreshControl, TouchableOpacity, Modal,
    Pressable, Animated, Alert, Dimensions,
} from "react-native";
import { getAuth } from "firebase/auth";
import { db } from "../../firebaseConfig";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import Ionicons from "react-native-vector-icons/Ionicons";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import * as Animatable from 'react-native-animatable';
import LinearGradient from 'react-native-linear-gradient';

// 🚨 IMPORTANT: Replace with your actual IP address and port
const BASE_URL = 'https://backendsuperviseme.vercel.app/api/feedback';

const { width, height } = Dimensions.get('window');

const theme = {
    primary: '#6366F1',
    secondary: '#8B5CF6',
    accent: '#00D4AA',
    background: '#0F172A',
    card: 'rgba(255, 255, 255, 0.1)',
    glass: 'rgba(255, 255, 255, 0.15)',
    text: '#FFFFFF',
    muted: '#94A3B8',
    success: '#00D4AA',
    error: '#FF6B9C',
    warning: '#FFB74D',
    star: '#FFD700',
    gradient1: ['#6366F1', '#8B5CF6', '#A855F7'],
    gradient2: ['#00D4AA', '#00B894', '#00A885'],
    gradient3: ['#FF6B9C', '#FF4757', '#FF3747']
};

/* --- UTILITY & ITEM COMPONENTS (ENHANCED UI) --- */
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
                size={22}
                color={i <= numRating ? theme.star : "#94A3B8"}
            />
        );
    }
    return <View style={{ flexDirection: "row", gap: 4 }}>{stars}</View>;
};

const RenderFeedbackItem = React.memo(({ item, isEvaluation }) => {
    // Displaying Supervisor Evaluation (Received by Student)
    if (isEvaluation) {
        return (
            <Animatable.View 
                animation="fadeInRight" 
                duration={600} 
                style={styles.feedbackCard}
            >
                <LinearGradient
                    colors={['rgba(0, 212, 170, 0.15)', 'rgba(0, 212, 170, 0.05)']}
                    style={styles.cardGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <View style={styles.feedbackHeader}>
                        <View style={styles.emailContainer}>
                            <Ionicons name="person-circle" size={16} color={theme.accent} />
                            <Text style={styles.feedbackEmail}>From: {item.supervisorEmail}</Text>
                        </View>
                        <View style={styles.feedbackDate}>
                            <Ionicons name="time" size={14} color={theme.muted} />
                            <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
                        </View>
                    </View>
                    
                    <View style={styles.ratingContainer}>
                        <Text style={styles.gradeLabel}>Grade:</Text>
                        <LinearGradient
                            colors={theme.gradient2}
                            style={styles.gradeBadge}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <Text style={styles.gradeText}>{item.grade || 'N/A'}</Text>
                        </LinearGradient>
                    </View>
                    
                    <View style={styles.commentContainer}>
                        <Ionicons name="chatbubble-ellipses" size={16} color={theme.accent} />
                        <Text style={styles.feedbackText}>"{item.evaluationBySupervisor || 'No comments provided.'}"</Text>
                    </View>
                </LinearGradient>
            </Animatable.View>
        );
    }
    
    // Displaying Student's Sent Feedback (Sent by Student)
    return (
        <Animatable.View 
            animation="fadeInLeft" 
            duration={600} 
            style={styles.feedbackCard}
        >
            <LinearGradient
                colors={['rgba(99, 102, 241, 0.15)', 'rgba(139, 92, 246, 0.05)']}
                style={styles.cardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={styles.feedbackHeader}>
                    <View style={styles.emailContainer}>
                        <Ionicons name="person-circle" size={16} color={theme.primary} />
                        <Text style={styles.feedbackEmail}>To: {item.supervisorEmail}</Text>
                    </View>
                    <View style={styles.feedbackDate}>
                        <Ionicons name="time" size={14} color={theme.muted} />
                        <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
                    </View>
                </View>
                
                <View style={styles.ratingContainer}>
                    <Text style={styles.ratingLabel}>Rating:</Text>
                    {renderStarsDisplay(item.ratingByStudent)}
                </View>
                
                <View style={styles.commentContainer}>
                    <Ionicons name="chatbubble" size={16} color={theme.primary} />
                    <Text style={styles.feedbackText}>"{item.feedbackByStudent}"</Text>
                </View>
            </LinearGradient>
        </Animatable.View>
    );
});

/* --- ENHANCED HEADER/FORM COMPONENT --- */
const StudentFormHeader = React.memo(({
    feedback, setFeedback, rating, setRating,
    handleSubmit, isLoading, handleClearFeedback, isClearing,
    hasActiveSupervision, currentSupervisor // 🔒 Added currentSupervisor prop
}) => {
    const renderRatingIcons = () => {
        const icons = [];
        for (let i = 1; i <= 5; i++) {
            icons.push(
                <TouchableOpacity key={i} onPress={() => setRating(i)}>
                    <MaterialIcons
                        name={i <= rating ? "star" : "star-border"}
                        size={36}
                        color={i <= rating ? theme.star : theme.muted}
                        style={{ marginHorizontal: 6 }}
                    />
                </TouchableOpacity>
            );
        }
        return (
            <View style={styles.ratingIconsContainer}>
                {icons}
            </View>
        );
    };

    return (
        <View style={styles.listHeaderContainer}>
            {/* Premium Header */}
            <Animatable.View animation="fadeInDown" duration={800}>
                <LinearGradient
                    colors={theme.gradient1}
                    style={styles.mainHeader}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <View style={styles.headerContent}>
                        <View style={styles.headerTextContainer}>
                            <Text style={styles.mainTitle}>Student Feedback</Text>
                            <Text style={styles.subTitle}>Share your experience with supervisors</Text>
                        </View>
                        <Animatable.View 
                            animation="pulse" 
                            iterationCount="infinite" 
                            style={styles.headerIcon}
                        >
                            <Ionicons name="chatbubbles" size={32} color="#FFF" />
                        </Animatable.View>
                    </View>
                </LinearGradient>
            </Animatable.View>

            {/* 🔒 Supervision Status Card */}
            {!hasActiveSupervision && (
                <Animatable.View animation="fadeInUp" delay={200} style={styles.warningCard}>
                    <View style={styles.warningHeader}>
                        <Ionicons name="warning" size={28} color={theme.warning} />
                        <Text style={styles.warningTitle}>Supervision Required</Text>
                    </View>
                    <Text style={styles.warningText}>
                        You must have an approved supervisor to submit feedback. Please request and get approval from a supervisor first through the Communication Tool.
                    </Text>
                    <View style={styles.supervisionSteps}>
                        <View style={styles.step}>
                            <View style={styles.stepNumber}>
                                <Text style={styles.stepNumberText}>1</Text>
                            </View>
                            <Text style={styles.stepText}>Go to Communication Tool</Text>
                        </View>
                        <View style={styles.step}>
                            <View style={styles.stepNumber}>
                                <Text style={styles.stepNumberText}>2</Text>
                            </View>
                            <Text style={styles.stepText}>Send request to supervisor</Text>
                        </View>
                        <View style={styles.step}>
                            <View style={styles.stepNumber}>
                                <Text style={styles.stepNumberText}>3</Text>
                            </View>
                            <Text style={styles.stepText}>Wait for approval</Text>
                        </View>
                        <View style={styles.step}>
                            <View style={styles.stepNumber}>
                                <Text style={styles.stepNumberText}>4</Text>
                            </View>
                            <Text style={styles.stepText}>Come back here to submit feedback</Text>
                        </View>
                    </View>
                </Animatable.View>
            )}

            {/* Submit Feedback Card - Only show if has active supervision */}
            {hasActiveSupervision && (
                <Animatable.View animation="fadeInUp" delay={300} style={styles.glassCard}>
                    <View style={styles.cardHeader}>
                        <LinearGradient
                            colors={['rgba(99, 102, 241, 0.3)', 'rgba(139, 92, 246, 0.2)']}
                            style={styles.cardIcon}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <Ionicons name="send" size={24} color="#FFF" />
                        </LinearGradient>
                        <Text style={styles.sectionHeader}>Submit Feedback to Your Supervisor</Text>
                    </View>

                    {/* Auto-selected Supervisor Info */}
                    <View style={styles.autoSupervisorContainer}>
                        <LinearGradient
                            colors={['rgba(0, 212, 170, 0.2)', 'rgba(0, 212, 170, 0.1)']}
                            style={styles.autoSupervisorBadge}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <Ionicons name="shield-checkmark" size={20} color={theme.accent} />
                            <Text style={styles.autoSupervisorText}>
                                Your Approved Supervisor: {currentSupervisor?.email || 'Loading...'}
                            </Text>
                        </LinearGradient>
                    </View>
                    
                    {/* Rating */}
                    <View style={styles.inputGroup}>
                        <View style={styles.inputLabelContainer}>
                            <Ionicons name="star" size={20} color={theme.star} />
                            <Text style={styles.inputLabel}>Rate Your Experience</Text>
                        </View>
                        {renderRatingIcons()}
                        {rating > 0 && (
                            <Text style={styles.ratingSelectedText}>
                                Selected: {rating} star{rating > 1 ? 's' : ''}
                            </Text>
                        )}
                    </View>

                    {/* Feedback Input */}
                    <View style={styles.inputGroup}>
                        <View style={styles.inputLabelContainer}>
                            <Ionicons name="document-text" size={20} color={theme.primary} />
                            <Text style={styles.inputLabel}>Your Feedback</Text>
                        </View>
                        <View style={[styles.glassInputContainer, styles.textAreaContainer]}>
                            <TextInput
                                value={feedback}
                                onChangeText={setFeedback}
                                placeholder="Share your detailed experience and suggestions for your supervisor..."
                                placeholderTextColor={theme.muted}
                                multiline
                                numberOfLines={4}
                                style={[styles.glassInput, styles.textArea]}
                            />
                        </View>
                        <Text style={styles.charCount}>
                            {feedback.length}/500 characters
                        </Text>
                    </View>

                    {/* Submit Button */}
                    <TouchableOpacity
                        style={[
                            styles.submitButton,
                            (!feedback.trim() || rating === 0) && styles.disabledButton
                        ]}
                        onPress={handleSubmit}
                        disabled={isLoading || !feedback.trim() || rating === 0}
                    >
                        <LinearGradient
                            colors={
                                (!feedback.trim() || rating === 0) 
                                    ? ['#94A3B8', '#64748B'] 
                                    : theme.gradient1
                            }
                            style={styles.submitButtonGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="white" size="small" />
                            ) : (
                                <>
                                    <Ionicons name="paper-plane" size={20} color="#FFF" />
                                    <Text style={styles.submitButtonText}>
                                        {!feedback.trim() ? 'Enter Feedback' :
                                         rating === 0 ? 'Select Rating' : 'Submit to Supervisor'}
                                    </Text>
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </Animatable.View>
            )}

            {/* Data Management Card - Only show if has active supervision */}
            {hasActiveSupervision && (
                <Animatable.View animation="fadeInUp" delay={500} style={styles.glassCard}>
                    <View style={styles.cardHeader}>
                        <LinearGradient
                            colors={['rgba(255, 107, 156, 0.3)', 'rgba(255, 71, 87, 0.2)']}
                            style={styles.cardIcon}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <MaterialIcons name="delete" size={24} color="#FFF" />
                        </LinearGradient>
                        <Text style={styles.sectionHeader}>Data Management</Text>
                    </View>

                    <TouchableOpacity
                        style={styles.clearButton}
                        onPress={handleClearFeedback}
                        disabled={isClearing}
                    >
                        <LinearGradient
                            colors={theme.gradient3}
                            style={styles.clearButtonGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <MaterialIcons name="delete-forever" size={20} color="#FFF" />
                            <Text style={styles.clearButtonText}>
                                {isClearing ? 'Clearing...' : 'Clear My Sent Feedback'}
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </Animatable.View>
            )}
        </View>
    );
});

/* --- MAIN STUDENT COMPONENT WITH FIXED SUPERVISION CHECK --- */
const StudentFeedbackScreen = () => {
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
    
    // 🔒 SECURITY: Supervision Status
    const [hasActiveSupervision, setHasActiveSupervision] = useState(false);
    const [checkingSupervision, setCheckingSupervision] = useState(true);
    const [currentSupervisor, setCurrentSupervisor] = useState(null);

    // Authentication
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
                setCheckingSupervision(false);
            }
        });
        Animated.timing(fadeAnim, { toValue: 1, duration: 1200, useNativeDriver: true }).start();
        return () => unsubscribe();
    }, [fadeAnim]);

    // 🔒 FIXED: Check Supervision Status - Handle both old and new API responses
    const checkSupervisionStatus = useCallback(async () => {
        if (!student) {
            setCheckingSupervision(false);
            return;
        }

        try {
            const token = await student.getIdToken();
            const checkRes = await fetch("https://backendsuperviseme.vercel.app/api/supervision-status", {
                method: 'GET',
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
            });

            if (checkRes.ok) {
                const supervisionData = await checkRes.json();
                console.log('Supervision API Response:', supervisionData); // Debug log
                
                // 🔒 HANDLE BOTH OLD AND NEW API RESPONSES
                // Old API returns: { isSupervised: true, supervisors: [] }
                // New API should return: { hasActiveSupervision: true, currentSupervisor: {}, approvedSupervisors: [] }
                
                if (supervisionData.isSupervised !== undefined) {
                    // OLD API FORMAT
                    setHasActiveSupervision(supervisionData.isSupervised);
                    if (supervisionData.isSupervised && supervisionData.supervisors && supervisionData.supervisors.length > 0) {
                        setCurrentSupervisor({ email: supervisionData.supervisors[0] });
                    } else {
                        setCurrentSupervisor(null);
                    }
                } else if (supervisionData.hasActiveSupervision !== undefined) {
                    // NEW API FORMAT
                    setHasActiveSupervision(supervisionData.hasActiveSupervision);
                    setCurrentSupervisor(supervisionData.currentSupervisor || null);
                } else {
                    // FALLBACK: Assume no supervision if format is unknown
                    setHasActiveSupervision(false);
                    setCurrentSupervisor(null);
                }
                
            } else {
                console.warn("Failed to check supervision status");
                checkSupervisionFallback();
            }
        } catch (error) {
            console.error("Supervision check error:", error);
            checkSupervisionFallback();
        } finally {
            setCheckingSupervision(false);
        }
    }, [student, studentEmail]);

    // 🔒 Fallback: Check supervision status from Firestore
    const checkSupervisionFallback = useCallback(() => {
        if (!studentEmail) return;

        const q = query(
            collection(db, "messages"),
            where("senderId", "==", studentEmail),
            where("status", "==", "Approved")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const approved = [];
            let currentSupervisorEmail = null;
            
            snapshot.forEach((doc) => {
                const data = doc.data();
                if (data.receiverId && !approved.find(s => s.email === data.receiverId)) {
                    // 🔒 SECURITY: Check if student is trying to send to themselves
                    if (data.receiverId === studentEmail) {
                        console.error("Security violation: Student cannot send feedback to themselves");
                        return;
                    }
                    
                    approved.push({
                        email: data.receiverId,
                        requestId: doc.id,
                        approvedAt: data.updatedAt || data.createdAt
                    });
                    currentSupervisorEmail = data.receiverId;
                }
            });
            
            setHasActiveSupervision(approved.length > 0);
            setCurrentSupervisor(approved.length > 0 ? { email: currentSupervisorEmail } : null);
        });

        return () => unsubscribe();
    }, [studentEmail]);

    // Check supervision status when student is available
    useEffect(() => {
        if (student) {
            checkSupervisionStatus();
        }
    }, [student, checkSupervisionStatus]);

    const showMessage = (message, error = false) => {
        setModalMessage(message);
        setIsError(error);
        setSuccessModal(true);
    };

    // Fetch function with enhanced security
    const fetchAllFeedback = useCallback(async () => {
        if (!studentEmail) { 
            setLoading(false); 
            setRefreshing(false); 
            return; 
        }
        
        setRefreshing(true); 
        if (feedbackSent.length === 0 && evaluationsReceived.length === 0) { 
            setLoading(true); 
        }

        try {
            if (!student) { 
                showMessage("Please login first", true); 
                return; 
            }

            // 🔒 SECURITY: Check supervision status before fetching feedback
            if (!hasActiveSupervision) {
                setFeedbackSent([]);
                setEvaluationsReceived([]);
                return;
            }

            const token = await student.getIdToken();
            const response = await fetch(`${BASE_URL}/student/${studentEmail}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            });

            if (response.ok) {
                const result = await response.json();
                const studentSent = (result.feedbackSent || []).filter(item => !item.studentDeleted);
                const supervisorReceived = (result.evaluationsReceived || []).filter(item => !item.supervisorDeleted);
                
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
    }, [studentEmail, student, hasActiveSupervision]);

    useEffect(() => {
        if (studentEmail && hasActiveSupervision) { 
            fetchAllFeedback(); 
        } else {
            setLoading(false);
            if (!hasActiveSupervision) {
                setFeedbackSent([]);
                setEvaluationsReceived([]);
            }
        }
    }, [fetchAllFeedback, studentEmail, hasActiveSupervision]);

    // 🔒 SECURITY: Enhanced submit function with multiple security checks
    const handleSubmit = async () => {
        if (submitting) return; 
        
        // Security checks
        if (!student) {
            showMessage("Please log in to submit feedback", true);
            return;
        }

        // 🔒 SECURITY: Check if user has active supervision
        if (!hasActiveSupervision) {
            showMessage("You must have an approved supervisor to submit feedback. Please get approval from a supervisor first through the Communication Tool.", true);
            return;
        }

        // 🔒 SECURITY: Validate current supervisor exists
        if (!currentSupervisor || !currentSupervisor.email) {
            showMessage("Unable to determine your supervisor. Please refresh and try again.", true);
            return;
        }

        // 🔒 SECURITY: Critical - Prevent student from sending feedback to themselves
        if (currentSupervisor.email === studentEmail) {
            showMessage("Security violation: Cannot send feedback to yourself.", true);
            return;
        }

        if (!feedback.trim() || rating === 0) {
            showMessage("Please provide a rating and feedback message", true);
            return;
        }

        // 🔒 SECURITY: Additional validation - feedback length
        if (feedback.trim().length > 500) {
            showMessage("Feedback must be less than 500 characters", true);
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
                    supervisorEmail: currentSupervisor.email, // 🔒 Auto-selected from supervision status
                    feedbackByStudent: feedback.trim(),
                    ratingByStudent: rating.toString(), 
                    type: 'student'
                })
            });

            const result = await response.json();

            if (result.success) {
                showMessage("Feedback submitted successfully to your supervisor!");
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

    // Clear function with security check
    const handleClearFeedback = () => {
        if (!hasActiveSupervision) {
            showMessage("No feedback to clear. You need an active supervisor to submit feedback.", true);
            return;
        }

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
    
    // Consolidated list for FlatList
    const allItemsToDisplay = [];
    let currentOverallIndex = 0; 

    // Only show feedback sections if user has active supervision
    if (hasActiveSupervision) {
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
    }

    const finalData = [{ type: 'form_header', uniqueId: 'form_0' }, ...allItemsToDisplay];

    // Show loading while checking supervision status
    if (checkingSupervision) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={styles.loadingText}>Checking supervision status...</Text>
            </View>
        );
    }

    return (
        <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
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
                                    feedback={feedback} setFeedback={setFeedback}
                                    rating={rating} setRating={setRating}
                                    handleSubmit={handleSubmit}
                                    isLoading={submitting}
                                    handleClearFeedback={handleClearFeedback} 
                                    isClearing={submitting}
                                    hasActiveSupervision={hasActiveSupervision}
                                    currentSupervisor={currentSupervisor} // 🔒 Pass current supervisor
                                />
                            );
                        }
                        
                        if (item.type === 'header') {
                            return (
                                <View key={item.uniqueId} style={styles.sectionHeaderWrapper}>
                                    <LinearGradient
                                        colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                                        style={styles.sectionHeaderContainer}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                    >
                                        <Text style={styles.sectionHeader}>{item.title}</Text>
                                        <View style={styles.countBadge}>
                                            <Text style={styles.countText}>
                                                {item.sectionId === 'received' ? evaluationsReceived.length : feedbackSent.length}
                                            </Text>
                                        </View>
                                    </LinearGradient>
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
                                    <Ionicons name="document-text" size={48} color={theme.muted} />
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
                <View style={styles.modalOverlay}>
                    <Animatable.View animation="bounceIn" style={styles.glassModal}>
                        <LinearGradient
                            colors={isError ? theme.gradient3 : theme.gradient2}
                            style={styles.modalHeader}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            {isError ? (
                                <Ionicons name="close-circle" size={48} color="#FFF" />
                            ) : (
                                <Ionicons name="checkmark-circle" size={48} color="#FFF" />
                            )}
                        </LinearGradient>
                        
                        <View style={styles.modalBody}>
                            <Text style={styles.modalTitle}>
                                {isError ? 'Operation Failed' : 'Success!'}
                            </Text>
                            <Text style={styles.modalText}>{modalMessage}</Text>
                        </View>
                        
                        <TouchableOpacity
                            style={styles.modalButton}
                            onPress={() => setSuccessModal(false)}
                        >
                            <LinearGradient
                                colors={isError ? theme.gradient3 : theme.gradient2}
                                style={styles.modalButtonGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <Text style={styles.modalButtonText}>Continue</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </Animatable.View>
                </View>
            </Modal>
        </Animated.View>
    );
};

// --- PREMIUM STYLES (Updated with security components) ---
const styles = StyleSheet.create({
    flex: { flex: 1, backgroundColor: theme.background },
    flatListContent: { paddingBottom: 40 },
    
    // Header Styles
    listHeaderContainer: { paddingBottom: 20 },
    mainHeader: {
        paddingHorizontal: 25,
        paddingTop: 60,
        paddingBottom: 30,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        marginBottom: 20,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerTextContainer: {
        flex: 1,
    },
    mainTitle: {
        fontSize: 32,
        fontWeight: '800',
        color: '#FFF',
        marginBottom: 8,
    },
    subTitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.8)',
        fontWeight: '500',
    },
    headerIcon: {
        padding: 12,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },

    // 🔒 Supervision Warning Card
    warningCard: {
        backgroundColor: 'rgba(255, 183, 77, 0.1)',
        borderRadius: 20,
        padding: 25,
        marginHorizontal: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 183, 77, 0.3)',
    },
    warningHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    warningTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: theme.warning,
        marginLeft: 12,
    },
    warningText: {
        color: theme.warning,
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 20,
        fontWeight: '500',
    },
    supervisionSteps: {
        gap: 12,
    },
    step: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    stepNumber: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: theme.warning,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    stepNumberText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: 'bold',
    },
    stepText: {
        color: theme.warning,
        fontSize: 14,
        fontWeight: '500',
        flex: 1,
    },

    // Auto Supervisor Selection
    autoSupervisorContainer: {
        marginBottom: 20,
    },
    autoSupervisorBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        gap: 10,
    },
    autoSupervisorText: {
        color: theme.accent,
        fontSize: 14,
        fontWeight: '600',
        flex: 1,
    },

    // Card Styles
    glassCard: {
        backgroundColor: theme.glass,
        borderRadius: 20,
        padding: 25,
        marginHorizontal: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    cardIcon: {
        width: 50,
        height: 50,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    sectionHeader: {
        fontSize: 20,
        fontWeight: '700',
        color: theme.text,
    },

    // Input Styles
    inputGroup: {
        marginBottom: 20,
    },
    inputLabelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    inputLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.text,
        marginLeft: 10,
    },
    glassInputContainer: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 15,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 15,
    },
    glassInput: {
        color: theme.text,
        fontSize: 16,
        fontWeight: '500',
    },
    textAreaContainer: {
        paddingVertical: 15,
    },
    textArea: {
        height: 120,
        textAlignVertical: 'top',
    },
    charCount: {
        color: theme.muted,
        fontSize: 12,
        textAlign: 'right',
        marginTop: 5,
    },

    // Rating Styles
    ratingIconsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginVertical: 10,
    },
    ratingSelectedText: {
        color: theme.accent,
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
        marginTop: 8,
    },

    // Button Styles
    submitButton: {
        borderRadius: 15,
        overflow: 'hidden',
        marginTop: 10,
        shadowColor: theme.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        elevation: 8,
    },
    disabledButton: {
        shadowColor: 'transparent',
        elevation: 0,
    },
    submitButtonGradient: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 18,
        paddingHorizontal: 30,
    },
    submitButtonText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '700',
        marginLeft: 10,
    },
    clearButton: {
        borderRadius: 15,
        overflow: 'hidden',
        marginTop: 10,
    },
    clearButtonGradient: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 25,
    },
    clearButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 10,
    },

    // Loading Styles
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.background,
        padding: 40,
    },
    loadingText: {
        color: theme.text,
        fontSize: 16,
        marginTop: 20,
        fontWeight: '600',
    },

    // Rest of the styles remain similar...
    feedbackCard: {
        marginHorizontal: 20,
        marginBottom: 15,
        borderRadius: 20,
        overflow: 'hidden',
    },
    cardGradient: {
        padding: 20,
        borderRadius: 20,
    },
    feedbackHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    emailContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    feedbackEmail: {
        fontWeight: '600',
        color: theme.text,
        fontSize: 16,
        marginLeft: 8,
    },
    feedbackDate: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dateText: {
        color: theme.muted,
        fontSize: 12,
        marginLeft: 4,
        fontWeight: '500',
    },
    ratingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    ratingLabel: {
        color: theme.text,
        marginRight: 12,
        fontWeight: '600',
        fontSize: 14,
    },
    gradeLabel: {
        color: theme.text,
        marginRight: 12,
        fontWeight: '600',
        fontSize: 14,
    },
    gradeBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    gradeText: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 14,
    },
    commentContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    feedbackText: {
        color: theme.text,
        lineHeight: 22,
        fontSize: 14,
        flex: 1,
        marginLeft: 10,
        fontWeight: '500',
    },

    // Section Header Styles
    sectionHeaderWrapper: {
        paddingHorizontal: 20,
        marginTop: 10,
        marginBottom: 15,
    },
    sectionHeaderContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    sectionHeader: {
        fontSize: 18,
        fontWeight: '700',
        color: theme.text,
    },
    countBadge: {
        backgroundColor: theme.primary,
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    countText: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 12,
    },

    // Empty State Styles
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        marginHorizontal: 20,
        marginBottom: 15,
        backgroundColor: theme.glass,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    emptyText: {
        color: theme.muted,
        fontSize: 16,
        marginTop: 15,
        fontWeight: '500',
        textAlign: 'center',
    },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    glassModal: {
        backgroundColor: theme.card,
        borderRadius: 25,
        width: '100%',
        maxWidth: 400,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        overflow: 'hidden',
    },
    modalHeader: {
        padding: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalBody: {
        padding: 30,
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: theme.text,
        marginBottom: 15,
        textAlign: 'center',
    },
    modalText: {
        fontSize: 16,
        color: theme.muted,
        textAlign: 'center',
        lineHeight: 22,
        fontWeight: '500',
    },
    modalButton: {
        margin: 20,
        borderRadius: 15,
        overflow: 'hidden',
    },
    modalButtonGradient: {
        paddingVertical: 16,
        paddingHorizontal: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
});

export default StudentFeedbackScreen;