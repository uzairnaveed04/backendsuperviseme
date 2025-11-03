import express from 'express';
import admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid'; 

const router = express.Router();

// Firestore reference
const adminDb = admin.firestore();

// Authentication Middleware (UNCHANGED)
const authenticateUser = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                success: false,
                error: 'Unauthorized - No token provided' 
            });
        }
        
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = decodedToken;
        next();
    } catch (error) {
        console.error('❌ Authentication error:', error);
        return res.status(401).json({ 
            success: false, 
            error: 'Unauthorized - Invalid token' 
        });
    }
};

// --------------------------------------------------------------------------------------------------
// --- POST /api/feedback/submit - Submit feedback (CRITICAL: Ensure submittedBy field is set) ---
// --------------------------------------------------------------------------------------------------
router.post('/submit', authenticateUser, async (req, res) => {
    try {
        const { studentEmail, supervisorEmail, type } = req.body;

        const sanitizedStudent = studentEmail.replace(/[.#$[\]/@]/g, '_');
        const sanitizedSupervisor = supervisorEmail.replace(/[.#$[\]/@]/g, '_');
        
        const uuid = uuidv4(); 
        const docId = `feedback_${sanitizedStudent}_${sanitizedSupervisor}_${uuid}`;

        console.log('📄 Creating document with ID:', docId);

        let feedbackData = {
            studentEmail: studentEmail.toLowerCase().trim(),
            supervisorEmail: supervisorEmail.toLowerCase().trim(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            feedbackId: uuid, 
            type: type,
            submittedBy: type === 'supervisor' ? 'supervisor' : 'student', 
            submittedAt: new Date().toISOString()
            // New documents start with NO delete flags
        };

        if (type === 'student') {
            const { ratingByStudent, feedbackByStudent } = req.body;
            feedbackData.ratingByStudent = parseInt(ratingByStudent) || 0;
            feedbackData.feedbackByStudent = feedbackByStudent?.trim() || '';
        } else if (type === 'supervisor') {
            const { evaluationBySupervisor, grade } = req.body;
            feedbackData.evaluationBySupervisor = evaluationBySupervisor?.trim() || '';
            feedbackData.grade = grade?.trim().toUpperCase() || '';
        }

        await adminDb
            .collection('feedbackEvaluation')
            .doc(docId)
            .set(feedbackData);

        res.json({ 
            success: true, 
            message: 'Feedback submitted successfully',
            feedbackId: docId 
        });
        
    } catch (error) {
        console.error('❌ Error submitting feedback:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error: ' + error.message 
        });
    }
});

// --------------------------------------------------------------------------------------------------
// --- GET /api/feedback/student/:email (UNCHANGED FETCH LOGIC) ---
// --------------------------------------------------------------------------------------------------
router.get('/student/:email', authenticateUser, async (req, res) => {
    try {
        const { email } = req.params;
        const userEmail = req.user.email;
        const studentEmail = email.toLowerCase();
        
        if (studentEmail !== userEmail.toLowerCase()) {
            return res.status(403).json({ success: false, error: 'Access denied - can only access your own feedback' });
        }
        
        const feedbackSnap = await adminDb
            .collection('feedbackEvaluation')
            .where('studentEmail', '==', studentEmail)
            .get();

        if (feedbackSnap.empty) {
            return res.json({ success: true, feedbackSent: [], evaluationsReceived: [], countSent: 0, countReceived: 0 });
        }

        const feedbackList = feedbackSnap.docs.map(doc => ({
            _id: doc.id, 
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
        }));

        const feedbackSent = feedbackList.filter(item => 
            item.submittedBy === 'student' || item.type === 'student'
        );
        const evaluationsReceived = feedbackList.filter(item => 
            item.submittedBy === 'supervisor' || item.type === 'supervisor'
        );

        feedbackSent.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        evaluationsReceived.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        console.log(`✅ Fetched Student Data. Sent: ${feedbackSent.length}, Received: ${evaluationsReceived.length}`);

        res.json({ 
            success: true, 
            feedbackSent: feedbackSent,
            evaluationsReceived: evaluationsReceived,
            countSent: feedbackSent.length,
            countReceived: evaluationsReceived.length
        });
        
    } catch (error) {
        console.error('❌ Error fetching student feedback:', error);
        res.status(500).json({ success: false, error: 'Internal server error: ' + error.message });
    }
});

// --------------------------------------------------------------------------------------------------
// --- GET /api/feedback/supervisor/:email (UNCHANGED FETCH LOGIC) ---
// --------------------------------------------------------------------------------------------------
router.get('/supervisor/:email', authenticateUser, async (req, res) => {
    try {
        const { email } = req.params;
        const userEmail = req.user.email;
        const supervisorEmail = email.toLowerCase();
        
        if (supervisorEmail !== userEmail.toLowerCase()) {
            return res.status(403).json({ success: false, error: 'Access denied - can only access your own feedback' });
        }
        
        const feedbackSnap = await adminDb
            .collection('feedbackEvaluation')
            .where('supervisorEmail', '==', supervisorEmail)
            .get();

        if (feedbackSnap.empty) {
            return res.json({ success: true, feedbackReceived: [], evaluationsSent: [], countReceived: 0, countSent: 0 });
        }

        const feedbackList = feedbackSnap.docs.map(doc => ({
            _id: doc.id, 
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
        }));

        feedbackList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const feedbackReceived = feedbackList.filter(item => 
            item.submittedBy === 'student' || item.type === 'student'
        );
        const evaluationsSent = feedbackList.filter(item => 
            item.submittedBy === 'supervisor' || item.type === 'supervisor'
        );

        console.log(`✅ Fetched Supervisor Data. Received: ${feedbackReceived.length}, Sent: ${evaluationsSent.length}`);

        res.json({ 
            success: true, 
            feedbackReceived: feedbackReceived, 
            evaluationsSent: evaluationsSent,     
            countReceived: feedbackReceived.length,
            countSent: evaluationsSent.length
        });
        
    } catch (error) {
        console.error('❌ Error fetching supervisor feedback:', error);
        res.status(500).json({ success: false, error: 'Internal server error: ' + error.message });
    }
});

// --------------------------------------------------------------------------------------------------
// --- DELETE /api/feedback/clear-student/:email (UPDATED to use SOFT DELETE) ---
// --------------------------------------------------------------------------------------------------
router.delete('/clear-student/:email', authenticateUser, async (req, res) => {
    try {
        const { email } = req.params;
        const userEmail = req.user.email;
        const studentEmail = email.toLowerCase();

        if (studentEmail !== userEmail.toLowerCase()) {
            return res.status(403).json({ success: false, error: 'Access denied - can only clear your own data' });
        }

        const feedbackSnap = await adminDb
            .collection('feedbackEvaluation')
            .where('studentEmail', '==', studentEmail)
            .where('submittedBy', '==', 'student') 
            .get();

        if (feedbackSnap.empty) {
            return res.status(200).json({ success: true, message: 'No student-submitted data found to clear', updatedCount: 0 });
        }

        const batch = adminDb.batch();
        feedbackSnap.docs.forEach(doc => {
            // 🔑 CRITICAL CHANGE: Set soft delete flag
            batch.update(doc.ref, {
                studentDeleted: true,
                deletedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        });

        await batch.commit();

        return res.status(200).json({
            success: true,
            message: `All student-submitted feedback marked as deleted successfully! (${feedbackSnap.docs.length} items updated)`,
            updatedCount: feedbackSnap.docs.length
        });
    } catch (error) {
        console.error('❌ Error clearing student data:', error);
        return res.status(500).json({ success: false, error: 'Internal server error: ' + error.message });
    }
});

// --------------------------------------------------------------------------------------------------
// --- DELETE /api/feedback/clear-supervisor/:email (UPDATED to use SOFT DELETE) ---
// --------------------------------------------------------------------------------------------------
router.delete('/clear-supervisor/:email', authenticateUser, async (req, res) => {
    try {
        const { email } = req.params;
        const userEmail = req.user.email;
        const supervisorEmail = email.toLowerCase();

        if (supervisorEmail !== userEmail.toLowerCase()) {
            return res.status(403).json({ success: false, error: 'Access denied - can only clear your own data' });
        }

        const feedbackSnap = await adminDb
            .collection('feedbackEvaluation')
            .where('supervisorEmail', '==', supervisorEmail)
            .where('submittedBy', '==', 'supervisor') 
            .get();

        if (feedbackSnap.empty) {
            return res.status(200).json({ success: true, message: 'No supervisor-submitted data found to clear', updatedCount: 0 });
        }

        const batch = adminDb.batch();
        feedbackSnap.docs.forEach(doc => {
            // 🔑 CRITICAL CHANGE: Set soft delete flag
            batch.update(doc.ref, {
                supervisorDeleted: true,
                deletedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        });

        await batch.commit();

        return res.status(200).json({
            success: true,
            message: `All supervisor-submitted evaluations marked as deleted successfully! (${feedbackSnap.docs.length} items updated)`,
            updatedCount: feedbackSnap.docs.length
        });
    } catch (error) {
        console.error('❌ Error clearing supervisor data:', error);
        return res.status(500).json({ success: false, error: 'Internal server error: ' + error.message });
    }
});

export default router;