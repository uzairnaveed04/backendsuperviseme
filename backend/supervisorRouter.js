import express from 'express';
import { db } from './firebaseAdmin.js';
import { verifyToken } from './authMiddleware.js';

const router = express.Router();

// ✅ NEW & OPTIMIZED: Get ALL supervisors with their availability status
// This endpoint is crucial for the frontend's fast loading time.
// Route: /all-supervisors
router.get('/all-supervisors', verifyToken, async (req, res) => {
    try {
        const supervisorsSnapshot = await db.collection('supervisors').get();
        
        const supervisorsWithAvailability = await Promise.all(
            supervisorsSnapshot.docs.map(async (supervisorDoc) => {
                const supervisorData = supervisorDoc.data();
                const supervisorEmail = supervisorData.email;

                // Handle documents with no email to prevent crashes
                if (!supervisorEmail || typeof supervisorEmail !== 'string') {
                    console.warn(`Skipping supervisor document with ID: ${supervisorDoc.id} due to missing or invalid email.`);
                    return null;
                }

                const approvedCountSnapshot = await db
                    .collection('messages')
                    .where('receiverId', '==', supervisorEmail)
                    .where('status', '==', 'Approved')
                    .get();
                
                const approvedCount = approvedCountSnapshot.size;

                return {
                    id: supervisorDoc.id,
                    email: supervisorEmail,
                    name: supervisorData.name || supervisorEmail.split("@")[0].replace(/[._]/g, " "),
                    avatar: supervisorData.avatar || "person-circle",
                    specialty: supervisorData.specialty || "Academic Supervisor",
                    available: approvedCount < 3,
                };
            })
        );
        
        const filteredSupervisors = supervisorsWithAvailability.filter(supervisor => supervisor !== null);
        res.json({ success: true, supervisors: filteredSupervisors });

    } catch (error) {
        console.error('Error fetching all supervisors with availability:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});


// ✅ Existing Endpoint: Check supervisor slot availability
// Route: /check-supervisor/:email
router.get("/check-supervisor/:email", verifyToken, async (req, res) => {
    try {
        const supervisorEmail = req.params.email;

        const snapshot = await db
            .collection("messages")
            .where("receiverId", "==", supervisorEmail)
            .where("status", "==", "Approved")
            .get();

        const count = snapshot.size;

        if (count >= 3) {
            return res.json({
                success: true,
                available: false,
                message: "❌ This supervisor already has 3 students.",
            });
        }

        return res.json({
            success: true,
            available: true,
            message: `✅ Slot available (${count}/3 used).`,
        });
    } catch (error) {
        console.error("Error checking supervisor slots:", error);
        res
            .status(500)
            .json({ success: false, message: "Internal Server Error" });
    }
});



// ✅ Existing Endpoint: Check a student's supervision status
// Route: /supervision-status
router.get('/supervision-status', verifyToken, async (req, res) => {
    try {
        const studentEmail = req.user.email;

        const snapshot = await db
            .collection('messages')
            .where('senderId', '==', studentEmail)
            .where('status', '==', 'Approved')
            .get();

        if (snapshot.empty) {
            return res.json({ success: true, isSupervised: false, supervisors: [] });
        }

        const supervisors = snapshot.docs.map(doc => doc.data().receiverId);

        return res.json({
            success: true,
            isSupervised: true,
            supervisors,
        });
    } catch (error) {
        console.error('Error checking supervision:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});








export default router;