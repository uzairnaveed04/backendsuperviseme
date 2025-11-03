import express from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
import { db } from './firebaseAdmin.js';
import { getFirestore, collection, query, where, getDocs, setDoc, doc, getDoc, writeBatch, orderBy } from 'firebase/firestore';
import admin from 'firebase-admin';
import serviceAccount from './serviceAccountKey.json' with { type: 'json' };
import path from "path";


import weeklyLogRoutes from "./weeklyLogRoutes.js";
import supervisorRouter from "./supervisorRouter.js";
// import studentRoutes from "./routes/studentRoutes.js";
import supervisorRoutes from "./routes/supervisorRoutes.js";
import uploadRouter from "./routes/uploadRouter.js";
import feedbackRoutes from './routes/feedbackRoutes.js'







// Initialize environment variables
dotenv.config();

// Initialize Express
const app = express();
app.use(cors());
app.use(express.json());
// Protected routes

app.use("/api/weekly-log", weeklyLogRoutes);
app.use("/api", supervisorRouter);
// app.use("/api/student", studentRoutes);
app.use("/api/supervisor", supervisorRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api", uploadRouter);

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));




// GitHub Configuration
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'Ov23liYfRRqZVQ9klJrx';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '52fa429f9841bad57d94f76743e05bb0ed340d01';

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
//   databaseURL: process.env.FIREBASE_DATABASE_URL
// });


// Use admin Firestore for privileged server writes
const adminDb = admin.firestore();



// ✅ Firebase Auth verify middleware

// ✅ AUTHENTICATION MIDDLEWARE
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authorization header required'
      });
    }

    const idToken = authHeader.split(' ')[1];
    console.log('🔍 Received token length:', idToken.length);
    console.log('🔍 Token preview:', idToken.substring(0, 50) + '...');
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    if (!decodedToken || !decodedToken.uid) {
      throw new Error('Invalid token payload');
    }

    // Add user info to request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: decodedToken.role || 'user'
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
};

// ✅ AUTHORIZATION HELPERS
const isStudent = (req) => req.user && req.user.role !== 'supervisor';
const isSupervisor = (req) => req.user && req.user.role === 'supervisor';
const isOwner = (req, resourceUID) => req.user && req.user.uid === resourceUID;

app.get('/env-test', (req, res) => {
  res.json({
    githubToken: process.env.GITHUB_TOKEN || 'Not found',
    firebaseKey: process.env.FIREBASE_API_KEY || 'Not found'
  });
});



// In-memory token store (replace with database for production)
let tokenStore = {};

// GitHub OAuth Endpoint with refresh token support
app.post('/github-auth', async (req, res) => {
  const { code, codeVerifier } = req.body;

  if (!code || !codeVerifier) {
    return res.status(400).json({
      success: false,
      error: 'Authorization code and code_verifier are required'
    });
  }

  try {
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        code_verifier: codeVerifier,
        grant_type: 'authorization_code'
      },
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        timeout: 5000
      }
    );

    if (!tokenResponse.data.access_token) {
      throw new Error('No access token received from GitHub');
    }

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Get user data
    let userResponse;
    try {
      userResponse = await axios.get('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${access_token}`,
          Accept: 'application/vnd.github+json'
        },
        timeout: 5000
      });
    } catch (userError) {
      console.error('Failed to fetch user data:', userError);
      throw new Error('Failed to fetch user information from GitHub');
    }

    const user = userResponse.data;

    // Save to Firebase (Admin SDK)
    try {
      const userDocRef = adminDb.doc(`github_users/${user.id.toString()}`);
      const authData = {
  access_token,
  expires_at: Date.now() + (expires_in ? expires_in * 1000 : 0),
  token_created_at: new Date().toISOString()
};

// Only add refresh_token if it exists
if (refresh_token) {
  authData.refresh_token = refresh_token;
}
      await userDocRef.set({
  profile: {
    username: user.login,
    email: user.email || '',
    avatar: user.avatar_url,
    last_updated: new Date().toISOString()
  },
  auth: authData
});

    } catch (firebaseError) {
      console.error('Firebase save error:', firebaseError);
      throw new Error('Failed to save user data to database');
    }

    tokenStore[user.login] = {
      access_token,
      refresh_token,
      expires_at: Date.now() + (expires_in ? expires_in * 1000 : 0)
    };

    res.json({
      success: true,
      access_token,
      refresh_token,
      expires_in,
      user_info: {
        id: user.id,
        username: user.login,
        avatar: user.avatar_url,
        name: user.name || user.login
      }
    });

  } catch (error) {
    console.error('GitHub Auth Error:', {
      message: error.message,
      response: error.response?.data,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'GitHub authentication failed',
      details: error.response?.data?.error_description || error.message,
    });
  }
});

// ✅ OLD VALIDATE-REPO ENDPOINT REMOVED - Using new authenticated endpoint below

// Refresh Token Endpoint
app.post('/refresh-github-token', async (req, res) => {
  const { username } = req.body;

  try {
    const userDocRef = doc(db, 'github_users', String(username));

    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      return res.status(404).json({ success: false, message: 'User not found in Firestore' });
    }

    const userData = userDoc.data();
    const refresh_token = userData?.auth?.refresh_token;

    if (!refresh_token) {
      return res.status(400).json({ success: false, message: 'Refresh token not found in Firestore' });
    }

    // Call GitHub token refresh endpoint
    const response = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token
      },
      {
        headers: { Accept: 'application/json' }
      }
    );

    const { access_token, refresh_token: new_refresh_token, expires_in } = response.data;

    // Save updated tokens back to Firestore
    await setDoc(userDocRef, {
      ...userData,
      auth: {
        ...userData.auth,
        access_token,
        refresh_token: new_refresh_token || refresh_token,
        expires_at: Date.now() + (expires_in ? expires_in * 1000 : 0),
        token_updated_at: new Date().toISOString()
      }
    });

    res.json({ success: true, access_token });
  } catch (error) {
    console.error('Refresh Error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to refresh token' });
  }
});
// Add this to your backend (before health check)
app.get('/test-repo-access', async (req, res) => {
  try {
    // Get parameters or use defaults matching your data
    const repoName = req.query.repo || 'team_project';
    const owner = req.query.owner || 'uzairnaveed04';
    
    // Access the repository document (note collection name spelling)
    const repoDocRef = doc(db, 'repositories', repoName);
    const docSnapshot = await getDoc(repoDocRef);

    if (!docSnapshot.exists()) {
      return res.status(404).json({
        success: false,
        error: 'Repository not found',
        suggestion: 'Check collection name (repositoryies) and document ID'
      });
    }


    const repoData = docSnapshot.data();
    
    // Verify owner match
    if (repoData.owner !== owner) {
      return res.json({
        success: false,
        warning: 'Owner mismatch',
        expectedOwner: owner,
        actualOwner: repoData.owner
      });
    }

    res.json({
      success: true,
      repository: {
        name: repoData.repoklame || repoData.repoName, // Handling potential typo
        owner: repoData.owner,
        teamMembers: repoData.teamMembers || [],
        lastUpdated: repoData.updatedAt
      },
      firestore: {
        collection: 'repositories',
        documentId: repoName
      }
    });

  } catch (error) {
    console.error('Repository Access Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: {
        firestoreStructure: {
          collections: ['repositories', 'github_users', 'projects'] // Your actual collections
        },
        commonIssues: [
          'Check collection name spelling (repositoryies)',
          'Verify document ID matches repo name',
          'Confirm Firebase service account has read permissions'
        ]
      }
    });
  }
});

app.post('/create-pr', async (req, res) => {
  // Get token from headers
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Authorization token required in Bearer format'
    });
  }
  const accessToken = authHeader.split(' ')[1];

  const { 
    githubUsername, 
    repo, 
    title, 
    head, 
    base = 'main',
    description = ''
  } = req.body;

  // Validate inputs
  if (!githubUsername || !repo || !title || !head) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields',
      required: ['githubUsername', 'repo', 'title', 'head'],
      received: Object.keys(req.body)
    });
  }

  try {
    // 1. Verify repository exists
    const repoCheck = await axios.get(
      `https://api.github.com/repos/${githubUsername}/${repo}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json'
        }
      }
    );

    // 2. Verify head branch exists
    try {
      await axios.get(
        `https://api.github.com/repos/${githubUsername}/${repo}/branches/${head}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json'
          }
        }
      );
    } catch (branchError) {
      return res.status(400).json({
        success: false,
        error: `Branch '${head}' not found`,
        details: branchError.response?.data || branchError.message,
        solution: 'Create the branch or check the name for typos'
      });
    }

    // 3. Verify branches are different
    const compareResponse = await axios.get(
      `https://api.github.com/repos/${githubUsername}/${repo}/compare/${base}...${head}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json'
        }
      }
    );

    if (compareResponse.data.status === 'identical') {
      return res.status(400).json({
        success: false,
        error: 'Cannot create PR - branches are identical',
        details: {
          ahead_by: compareResponse.data.ahead_by,
          behind_by: compareResponse.data.behind_by,
          status: compareResponse.data.status
        },
        solution: 'Make changes on your branch before creating PR'
      });
    }

    // 4. Create the pull request
    const prResponse = await axios.post(
      `https://api.github.com/repos/${githubUsername}/${repo}/pulls`,
      {
        title,
        head,
        base,
        body: description,
        maintainer_can_modify: true
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    );

    const prData = prResponse.data;

    // 5. Save to Firestore (Admin)
    const prDocRef = adminDb.doc(`pull_requests/${`${repo}-${prData.number}`}`);
    await prDocRef.set({
      repo: `${githubUsername}/${repo}`,
      pr_number: prData.number,
      title: prData.title,
      description: prData.body,
      head: {
        ref: prData.head.ref,
        sha: prData.head.sha,
        repo: prData.head.repo?.full_name || `${githubUsername}/${repo}`
      },
      base: {
        ref: prData.base.ref,
        sha: prData.base.sha,
        repo: prData.base.repo?.full_name || `${githubUsername}/${repo}`
      },
      status: prData.state,
      created_at: new Date(prData.created_at).toISOString(),
      updated_at: new Date(prData.updated_at).toISOString(),
      creator: prData.user.login,
      github_url: prData.html_url,
      mergeable: prData.mergeable,
      mergeable_state: prData.mergeable_state,
      commits: prData.commits,
      additions: prData.additions,
      deletions: prData.deletions,
      changed_files: prData.changed_files,
      firestore_timestamp: new Date().toISOString()
    }, { merge: true });

    return res.json({
      success: true,
      pr_number: prData.number,
      url: prData.html_url,
      firestore_id: `${repo}-${prData.number}`,
      details: {
        title: prData.title,
        head: prData.head.ref,
        base: prData.base.ref,
        status: prData.state,
        commits_ahead: compareResponse.data.ahead_by
      }
    });

  } catch (error) {
    console.error('PR Creation Error:', {
      timestamp: new Date().toISOString(),
      endpoint: '/create-pr',
      user: githubUsername,
      repo: repo,
      error: {
        status: error.response?.status,
        message: error.response?.data?.message,
        errors: error.response?.data?.errors,
        url: error.config?.url
      }
    });

    let statusCode = error.response?.status || 500;
    let errorMessage = 'Failed to create pull request';
    let details = error.response?.data || error.message;

    if (statusCode === 422) {
      errorMessage = 'Validation failed';
      if (details?.errors) {
        errorMessage += ': ' + details.errors.map(e => e.message).join(', ');
      } else if (details.message?.includes('No commits between')) {
        errorMessage = 'No difference between branches';
      }
    }

    return res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details: details,
      solutions: [
        'Verify both branches exist and have differences',
        'Check branch names for typos',
        'Ensure your branch has commits not present in base branch'
      ]
    });
  }
});

// File Upload Endpoint
app.post('/upload-code', async (req, res) => {
  const {
    accessToken,
    githubUsername,
    repoName,
    filePath,
    fileContent,
    commitMessage = 'Code upload from mobile app'
  } = req.body;

  // Validation
  if (!accessToken || !githubUsername || !repoName || !filePath || !fileContent) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields',
      required: ['accessToken', 'githubUsername', 'repoName', 'filePath', 'fileContent']
    });
  }

  try {
    // 1. Verify repository exists
    const repoUrl = `https://api.github.com/repos/${githubUsername}/${repoName}`;
    await axios.get(repoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json'
      }
    });

    // 2. Check if file exists to get its SHA (for updates)
    let fileSha = null;
    try {
      const existingFile = await axios.get(
        `https://api.github.com/repos/${githubUsername}/${repoName}/contents/${filePath}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json'
          }
        }
      );
      fileSha = existingFile.data.sha;
    } catch (e) {
      // File doesn't exist (new file), SHA remains null
    }

    // 3. Create/update file payload
    const payload = {
      message: commitMessage,
      content: Buffer.from(fileContent).toString('base64'),
      committer: {
        name: `${githubUsername} (via App)`,
        email: `${githubUsername}@users.noreply.github.com`
      }
    };

    // Add SHA only if updating an existing file
    if (fileSha) {
      payload.sha = fileSha;
    }

    // 4. Upload the file
    const fileUrl = `https://api.github.com/repos/${githubUsername}/${repoName}/contents/${filePath}`;
    const response = await axios.put(fileUrl, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });

    // 5. Save successful upload to Firestore (github_uploads only)
    const uploadData = {
      repo: `${githubUsername}/${repoName}`,
      filePath,
      fileName: filePath.split('/').pop(),
      fileSize: Buffer.byteLength(fileContent, 'utf8'),
      commitSha: response.data.commit.sha,
      committer: githubUsername,
      timestamp: new Date().toISOString(),
      commitUrl: response.data.commit.html_url,
      fileUrl: response.data.content.html_url,
      status: 'success',
      action: fileSha ? 'updated' : 'created'
    };

    const uploadRef = adminDb.doc(`github_uploads/${`${repoName}-${filePath.replace(/[^a-zA-Z0-9]/g, '_')}-${Date.now()}`}`);
    await uploadRef.set(uploadData);

    return res.json({
      success: true,
      commit: response.data.commit,
      file: {
        path: response.data.content.path,
        url: response.data.content.html_url
      },
      firestoreId: uploadRef.id
    });

  } catch (error) {
    // Simplified error handling (no Firestore error logging)
    console.error('Upload Failed:', {
      user: githubUsername,
      repo: repoName,
      error: error.response?.data?.message || error.message
    });

    return res.status(error.response?.status || 500).json({
      success: false,
      error: 'Upload failed',
      details: error.response?.data || error.message
    });
  }
});
// Get Student Project Data
// Connection Endpoints
// POST: Create connection between student and supervisor
// Make sure this endpoint exists in your backend
app.post('/connect-supervisor', async (req, res) => {
  let { studentEmail, supervisorEmail, studentUID } = req.body;

  try {
    // Verify authorization header exists
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authorization header required',
        solution: 'Include a valid Firebase ID token in the Authorization header'
      });
    }

    // Extract and verify ID token
    const idToken = authHeader.split(' ')[1];
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
      if (!decodedToken || !decodedToken.uid) {
        throw new Error('Invalid token payload');
      }
    } catch (error) {
      console.error('Token verification error:', error);
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
        details: error.message
      });
    }

    const callerUID = decodedToken.uid;
    const finalStudentUID = studentUID || callerUID;

    const studentRef = doc(db, 'github_users', studentEmail.replace(/\./g, '_'));
    const studentSnap = await getDoc(studentRef);

    if (!studentSnap.exists()) {
      return res.status(404).json({
        success: false,
        error: 'Student not registered',
        solution: 'Complete GitHub registration first'
      });
    }

    const connectionId = `${Date.now()}_${studentEmail}_${supervisorEmail}`;
    const supervisorEmailLower = supervisorEmail.toLowerCase();

    // Use correct collection name: connection_requests (not connectionrequests)
    await adminDb.doc(`connection_requests/${connectionId}`).set({
      studentUID: finalStudentUID,
      studentEmail,
      safeStudentEmail: studentEmail.replace(/\./g, '_'),
      supervisorEmail: supervisorEmailLower,
      safeSupervisorEmail: supervisorEmailLower.replace(/\./g, '_'),
      status: 'pending',
      createdAt: new Date(),
      githubUsername: studentSnap.data().profile.username
    });

    res.json({ success: true, connectionId });
  } catch (error) {
    console.error('Connection request error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// app.get('/supervisor-view/:supervisorEmail', async (req, res) => {
//   const { supervisorEmail } = req.params;

//   try {
//     // 1. Get approved connections
//     const connectionsQuery = query(
//       collection(db, 'supervisor_connections'),
//       where('supervisorEmail', '==', supervisorEmail.replace(/\./g, '_')),
//       where('status', '==', 'approved')
//     );
    
//     const connectionsSnapshot = await getDocs(connectionsQuery);
//     const studentsData = [];

//     // 2. Get data for each connected student
//     for (const doc of connectionsSnapshot.docs) {
//       const connection = doc.data();
      
//       // Get student profile
//       const studentDoc = await getDoc(doc(db, 'github_users', connection.studentEmail));
//       const studentData = studentDoc.exists() ? studentDoc.data() : null;
      
//       // Get repositories
//       const reposQuery = query(
//         collection(db, 'github_upload'),
//         where('owner', '==', studentData?.profile?.username || '')
//       );
//       const reposSnapshot = await getDocs(reposQuery);
//       const reposData = reposSnapshot.docs.map(doc => doc.data());
      
//       studentsData.push({
//         connectionId: doc.id,
//         ...connection,
//         student: studentData?.profile || null,
//         repositories: reposData,
//         contributions: studentData?.contributions || []
//       });
//     }

//     res.json({
//       success: true,
//       students: studentsData
//     });

//   } catch (error) {
//     console.error('Supervisor view error:', error);
//     res.status(500).json({
//       success: false,
//       error: error.message
//     });
//   }
// });


app.post('/create-team-repo', async (req, res) => {
  const { 
    teamName,
    members = [],
    permission = 'push',
    studentUID: bodyStudentUID,
    studentGithubAccessToken,
    githubUsername
  } = req.body;

  try {
    // 1. Verify authorization header exists
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false,
        error: 'Authorization header required',
        solution: 'Include a valid Firebase ID token in the Authorization header'
      });
    }

    // 2. Extract and verify ID token
    const idToken = authHeader.split(' ')[1];
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
      if (!decodedToken || !decodedToken.uid) {
        throw new Error('Invalid token payload');
      }
    } catch (error) {
      console.error('Token verification error:', error);
      return res.status(401).json({ 
        success: false,
        error: 'Invalid or expired token',
        details: error.message,
        solution: 'Refresh your Firebase authentication token'
      });
    }

    // 3. Identify caller and resolve supervisorUID if there is an active connection
    const callerUID = decodedToken.uid;
    const studentUID = bodyStudentUID || callerUID; // trust token over body to avoid mismatches
    let supervisorUID = null;

    // Case A: student is calling (callerUID equals provided studentUID)
    if (callerUID === studentUID) {
      const connQuery = query(
        collection(db, 'connections'),
        where('studentUID', '==', studentUID),
        where('status', '==', 'active')
      );
      const connSnap = await getDocs(connQuery);
      if (!connSnap.empty) {
        // Use the first active connection if available
        supervisorUID = connSnap.docs[0].data().supervisorUID;
      }
    } else {
      // Case B: supervisor is calling; verify specific connection
      const connectionRef = doc(db, 'connections', `${studentUID}_${callerUID}`);
    const connectionSnap = await getDoc(connectionRef);
    if (!connectionSnap.exists() || connectionSnap.data().status !== 'active') {
        // Allow creation but mark as pendingApproval
        supervisorUID = null;
      } else {
        supervisorUID = callerUID;
      }
    }

    

    

    // 5. Get student's GitHub info (prefer token provided by the caller)
    let studentAccessToken = studentGithubAccessToken;
    let resolvedGithubUsername = githubUsername;

    if (!studentAccessToken || !resolvedGithubUsername) {
      return res.status(403).json({
        success: false,
        error: 'Student GitHub account not linked',
        solution: 'Provide studentGithubAccessToken and githubUsername from the authenticated student session'
      });
    }

    // 6. Create repository using student's GitHub token
    const repoResponse = await axios.post(
      'https://api.github.com/user/repos',
      {
        name: teamName,
        private: true,
        auto_init: true,
        description: `Team repository for ${teamName}`
      },
      {
        headers: {
          Authorization: `Bearer ${studentAccessToken}`,
          Accept: 'application/vnd.github+json'
        },
        timeout: 10000
      }
    );

    // 7. Add collaborators with error handling
    // Normalize team members: trim, lowercase, unique, and exclude repo owner
    const normalizedMembers = Array.from(new Set(
      (members || [])
        .map(m => (typeof m === 'string' ? m.trim() : ''))
        .filter(Boolean)
        .map(m => m.toLowerCase())
    )).filter(m => m !== resolvedGithubUsername.toLowerCase());

    const collaboratorPromises = normalizedMembers.map(async (member) => {
      try {
        await axios.put(
          `https://api.github.com/repos/${resolvedGithubUsername}/${teamName}/collaborators/${member}`,
          { permission },
          {
            headers: {
              Authorization: `Bearer ${studentAccessToken}`,
              Accept: 'application/vnd.github+json'
            },
            timeout: 8000
          }
        );
        return { username: member, status: 'success' };
      } catch (error) {
        return {
          username: member,
          status: 'failed',
          error: error.response?.data?.message || error.message,
          code: error.response?.status
        };
      }
    });

    const collaboratorResults = await Promise.all(collaboratorPromises);

    // 8. Save to Firestore with batch write (Admin)
    const batch = adminDb.batch();
    
    // Main repository document
    const repoRef = adminDb.doc(`team_repositories/${`${resolvedGithubUsername}_${teamName}`.toLowerCase()}`);
    batch.set(repoRef, {
      name: teamName,
      owner: resolvedGithubUsername,
      supervisorUID: supervisorUID,
      teamMembers: members,
      studentUID: studentUID,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      githubUrl: repoResponse.data.html_url,
      apiUrl: repoResponse.data.url,
      connectionId: supervisorUID ? `${studentUID}_${supervisorUID}` : null,
      pendingApproval: supervisorUID ? false : true,
      collaborators: collaboratorResults,
      metadata: {
        private: repoResponse.data.private,
        size: repoResponse.data.size,
        defaultBranch: repoResponse.data.default_branch
      }
    });
    
    // Add to student's repositories subcollection
    const studentRepoRef = adminDb.doc(`students/${studentUID}/repositories/${teamName}`);
    batch.set(studentRepoRef, {
      name: teamName,
      owner: githubUsername,
      url: repoResponse.data.html_url,
      createdAt: new Date().toISOString(),
      pendingApproval: supervisorUID ? false : true
    });
    
    await batch.commit();

    res.json({
      success: true,
      repo: {
        name: repoResponse.data.name,
        url: repoResponse.data.html_url,
        private: repoResponse.data.private
      },
      collaborators: {
        total: members.length,
        successful: collaboratorResults.filter(r => r.status === 'success').length,
        results: collaboratorResults
      },
      firestore: {
        mainDocument: repoRef.id,
        studentDocument: studentRepoRef.id
      }
    });

  } catch (error) {
    console.error('Team Repo Creation Error:', {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack,
      requestBody: req.body
    });

    const statusCode = error.response?.status || 500;
    const errorData = error.response?.data || {};
    
    res.status(statusCode).json({
      success: false,
      error: 'Failed to create team repository',
      details: {
        githubError: errorData.message,
        firebaseError: error.firebaseError || null,
        validationErrors: errorData.errors || null
      },
      solutions: [
        'Verify GitHub token permissions (need repo scope)',
        'Check repository name availability',
        'Ensure all team members exist on GitHub'
      ]
    });
  }
});

// Add this new endpoint
app.get('/api/supervisor/repo-activity/:owner/:repoName', async (req, res) => {
  try {
    const { owner, repoName } = req.params;
    const authHeader = req.headers.authorization;
    const fullRepoName = `${owner}/${repoName}`;

    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization required' });
    }

    // Extract supervisor UID from the auth token
    const token = authHeader.split(' ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const supervisorUID = decodedToken.uid;

    // Find the repository document by fields to avoid ID format mismatches
    const repoQuery = query(
      collection(db, 'team_repositories'),
      where('owner', '==', owner),
      where('name', '==', repoName)
    );
    const repoSnapshot = await getDocs(repoQuery);
    if (repoSnapshot.empty) {
      return res.status(404).json({ error: 'Repository not found' });
    }
    const repoData = repoSnapshot.docs[0].data();
    if (repoData.supervisorUID !== supervisorUID) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get all activity documents for this repo
    const querySnapshot = await getDocs(
      query(
        collection(db, 'github_uploads'),
        where('repo', '==', fullRepoName),
        orderBy('timestamp', 'desc')
      )
    );

    const activities = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || doc.data().timestamp
    }));

    res.json({
      success: true,
      data: activities,
      connectionId: repoData.connectionId
    });

  } catch (error) {
    console.error('Error fetching repo activity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch repository activity'
    });
  }
});



// Get all repositories
app.get('/api/supervisor/all-repos', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = await admin.auth().verifyIdToken(token);
    const supervisorUID = decoded.uid;

    // 1) Get active connections for this supervisor
    const activeConnSnap = await adminDb
      .collection('connections')
      .where('supervisorUID', '==', supervisorUID)
      .where('status', '==', 'active')
      .get();

    const studentUIDs = activeConnSnap.docs.map(d => d.data().studentUID);

    // 2) Fetch repos owned by this supervisor
    const ownReposSnap = await adminDb
      .collection('team_repositories')
      .where('supervisorUID', '==', supervisorUID)
      .get();

    const reposMap = new Map();
    ownReposSnap.forEach(doc => {
      const data = doc.data();
      reposMap.set(doc.id, {
        id: doc.id,
        name: data.name,
        owner: data.owner,
        githubUrl: data.githubUrl,
        createdAt: data.createdAt,
        memberCount: data.teamMembers?.length || 0
      });
    });

    // 3) Include repos from connected students even if pendingApproval or missing supervisorUID
    await Promise.all(studentUIDs.map(async (stuId) => {
      const stuReposSnap = await adminDb
        .collection('team_repositories')
        .where('studentUID', '==', stuId)
        .get();
      stuReposSnap.forEach(doc => {
        const data = doc.data();
        // Don't overwrite existing supervisor-owned records
        if (!reposMap.has(doc.id)) {
          reposMap.set(doc.id, {
            id: doc.id,
            name: data.name,
            owner: data.owner,
            githubUrl: data.githubUrl,
            createdAt: data.createdAt,
            memberCount: data.teamMembers?.length || 0
          });
        }
      });
    }));

    const repos = Array.from(reposMap.values());
    res.json({ success: true, data: repos });
  } catch (error) {
    console.error('Error fetching all repos:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Link already-created student repos to the approving supervisor
app.post('/link-student-repos', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Authorization required' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = await admin.auth().verifyIdToken(token);
    const supervisorUID = decoded.uid;

    const { studentUID } = req.body;
    if (!studentUID) {
      return res.status(400).json({ success: false, error: 'studentUID is required' });
    }

    // Find repos for this student that are pending or missing supervisor
    const reposSnap = await adminDb
      .collection('team_repositories')
      .where('studentUID', '==', studentUID)
      .get();

    if (reposSnap.empty) {
      return res.json({ success: true, updated: 0 });
    }

    const batch = adminDb.batch();
    const connectionId = `${studentUID}_${supervisorUID}`;

    reposSnap.forEach((docRef) => {
      const data = docRef.data();
      // Only relink if not already linked to some supervisor
      if (!data.supervisorUID || data.pendingApproval) {
        batch.update(docRef.ref, {
          supervisorUID,
          connectionId,
          pendingApproval: false,
          updatedAt: new Date().toISOString()
        });
      }
    });

    // Update student's repo subcollection flags
    const studentReposSnap = await adminDb
      .collection(`students/${studentUID}/repositories`)
      .get();

    studentReposSnap.forEach((subDoc) => {
      batch.update(subDoc.ref, {
        pendingApproval: false,
        updatedAt: new Date().toISOString()
      });
    });

    await batch.commit();
    return res.json({ success: true, updated: reposSnap.size });
  } catch (error) {
    console.error('Link student repos error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get repos for a specific student (supervisor-authenticated)
app.get('/api/supervisor/student-repos/:studentUID', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Authorization required' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = await admin.auth().verifyIdToken(token);
    const supervisorUID = decoded.uid;

    const { studentUID } = req.params;
    if (!studentUID) {
      return res.status(400).json({ success: false, error: 'studentUID is required' });
    }

    // Return repos for the student regardless of supervisor, but include flags
    const reposSnap = await adminDb
      .collection('team_repositories')
      .where('studentUID', '==', studentUID)
      .get();

    const repos = [];
    reposSnap.forEach((doc) => {
      const data = doc.data();
      repos.push({ id: doc.id, ...data, isOwnedBySupervisor: data.supervisorUID === supervisorUID });
    });

    return res.json({ success: true, data: repos });
  } catch (error) {
    console.error('Fetch student repos error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get contributors grouped by activity for a repo
app.get('/api/supervisor/repo-data/:owner/:repo', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Authorization required' });
    }
    // verify token; not strictly needed for GitHub calls, but we keep it consistent
    const token = authHeader.split(' ')[1];
    await admin.auth().verifyIdToken(token);

    const { owner, repo } = req.params;
    const sinceDays = Number(req.query.days || 21);
    const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();

    const ghHeaders = {
      Accept: 'application/vnd.github+json',
    };
    // Prefer repo owner's token (to access private repos). Fallback to server token.
    try {
      const ownerResp = await axios.get(`https://api.github.com/users/${owner}`, {
        headers: { Accept: 'application/vnd.github+json' },
        timeout: 8000,
      });
      const ownerId = String(ownerResp.data.id);
      const ownerDoc = await adminDb.doc(`github_users/${ownerId}`).get();
      const ownerToken = ownerDoc.exists ? ownerDoc.data()?.auth?.access_token : null;
      if (ownerToken) {
        ghHeaders.Authorization = `Bearer ${ownerToken}`;
      } else if (process.env.GITHUB_TOKEN) {
        ghHeaders.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
      }
    } catch (e) {
      if (process.env.GITHUB_TOKEN) {
        ghHeaders.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
      }
    }

    // 1) Contributors list (GitHub counts; may exclude zero-commit members)
    const contributorsResp = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/contributors`,
      { headers: ghHeaders, timeout: 10000 }
    );
    const contributors = Array.isArray(contributorsResp.data)
      ? contributorsResp.data.map(c => ({
          login: c.login,
          avatar: c.avatar_url,
          commits: c.contributions || 0,
        }))
      : [];

    // 2) Commits since window to determine active logins
    const commitsResp = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/commits`,
      { params: { since, per_page: 100 }, headers: ghHeaders, timeout: 12000 }
    );
    const activeLogins = new Set();
    commitsResp.data.forEach(c => {
      if (c.author?.login) activeLogins.add(c.author.login);
      if (c.committer?.login) activeLogins.add(c.committer.login);
      // Fallback: try to map names to logins if exact match exists
      const name = c.commit?.author?.name;
      if (name) {
        const match = contributors.find(x => x.login.toLowerCase() === name.toLowerCase());
        if (match) activeLogins.add(match.login);
      }
    });

    // 3) Accepted collaborators (those with repo access)
    const collabResp = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/collaborators`,
      { headers: ghHeaders, timeout: 10000 }
    );
    const acceptedCollabs = Array.isArray(collabResp.data)
      ? collabResp.data.map(u => ({ login: u.login, avatar: u.avatar_url }))
      : [];
    const acceptedSet = new Set(acceptedCollabs.map(c => c.login));

    // 4) Pending invitations
    let pendingInvites = [];
    try {
      const invitesResp = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/invitations`,
        { headers: ghHeaders, timeout: 10000 }
      );
      if (Array.isArray(invitesResp.data)) {
        pendingInvites = invitesResp.data
          .map(i => ({ login: i.invitee?.login, avatar: i.invitee?.avatar_url }))
          .filter(i => i.login);
      }
    } catch (e) {
      // If token lacks scope to view invitations, just skip
    }

    // 5) Partition into active/inactive
    const active = [];
    const inactive = [];
    // Use accepted collaborators as baseline; mark active by commits
    acceptedCollabs.forEach(c => {
      if (activeLogins.has(c.login)) active.push({ ...c, commits: contributors.find(x => x.login === c.login)?.commits || 0 });
      else inactive.push({ ...c, commits: 0 });
    });
    // Add pending invites to inactive with flag
    pendingInvites.forEach(p => {
      if (!acceptedSet.has(p.login)) {
        inactive.push({ ...p, commits: 0, pendingInvite: true });
      }
    });

    return res.json({
      success: true,
      data: { contributors: { active, inactive, totalAccepted: acceptedCollabs.length, totalPending: pendingInvites.length } },
      since,
    });
  } catch (error) {
    console.error('Repo data error:', error?.response?.data || error.message);
    const status = error.response?.status || 500;
    return res.status(status).json({ success: false, error: 'Failed to fetch repo data', details: error.response?.data || error.message });
  }
});

// Example endpoint to get supervisor's connections
app.get('/api/supervisor/connections', async (req, res) => {
  try {
    // Verify supervisor token
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const supervisorUID = decodedToken.uid;
    const supervisorEmail = decodedToken.email;

    console.log('🔍 Supervisor API Debug:');
    console.log('- UID:', supervisorUID);
    console.log('- Email:', supervisorEmail);

    // Get pending requests by email (not UID)
    const requestsQuery1 = query(
      collection(db, 'connection_requests'),
      where('supervisorEmail', '==', supervisorEmail),
      where('status', '==', 'pending')
    );

    // Also try safe email format
    const safeSupervisorEmail = supervisorEmail.replace(/\./g, '_');
    const requestsQuery2 = query(
      collection(db, 'connection_requests'),
      where('safeSupervisorEmail', '==', safeSupervisorEmail),
      where('status', '==', 'pending')
    );

    const [requestsSnapshot1, requestsSnapshot2] = await Promise.all([
      getDocs(requestsQuery1),
      getDocs(requestsQuery2)
    ]);

    console.log('📊 API Query Results:');
    console.log('- Email query:', requestsSnapshot1.docs.length, 'results');
    console.log('- Safe email query:', requestsSnapshot2.docs.length, 'results');

    // Combine and deduplicate results
    const allDocs = [...requestsSnapshot1.docs, ...requestsSnapshot2.docs];
    const uniqueDocs = allDocs.filter((doc, index, self) =>
      index === self.findIndex(d => d.id === doc.id)
    );

    const requests = uniqueDocs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log('✅ Final API requests:', requests.length);

    res.json({ success: true, data: requests });
  } catch (error) {
    console.error('Error getting connections:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// ✅ SUPERVISOR VERIFICATION ENDPOINT
app.post('/api/supervisor/verify', authenticateUser, async (req, res) => {
  try {
    const { email } = req.body;
    const userEmail = req.user.email;

    // Verify the email matches the authenticated user
    if (email !== userEmail) {
      return res.status(403).json({
        success: false,
        error: 'Email mismatch'
      });
    }

    // Check if supervisor exists in supervisors collection
    const supervisorSnap = await adminDb
      .collection('supervisors')
      .where('email', '==', email)
      .get();

    if (supervisorSnap.empty) {
      return res.status(404).json({
        success: false,
        error: 'Email not found in Firestore. Access denied.'
      });
    }

    const supervisorData = supervisorSnap.docs[0].data();

    console.log('✅ Supervisor verified:', email);
    res.json({
      success: true,
      supervisor: {
        id: supervisorSnap.docs[0].id,
        email: supervisorData.email,
        name: supervisorData.name || 'Supervisor'
      }
    });
  } catch (error) {
    console.error('Error verifying supervisor:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ✅ SUPERVISOR PROFILE ENDPOINT
app.get('/api/supervisor/profile', authenticateUser, async (req, res) => {
  try {
    const userEmail = req.user.email;

    // Get supervisor profile from supervisors collection
    const supervisorSnap = await adminDb
      .collection('supervisors')
      .where('email', '==', userEmail)
      .get();

    if (supervisorSnap.empty) {
      return res.status(404).json({
        success: false,
        error: 'Supervisor profile not found'
      });
    }

    const supervisorData = supervisorSnap.docs[0].data();

    console.log('✅ Supervisor profile fetched:', userEmail);
    res.json({
      success: true,
      supervisor: {
        id: supervisorSnap.docs[0].id,
        email: supervisorData.email,
        name: supervisorData.name || 'Supervisor',
        password: supervisorData.password || '123456',
        createdAt: supervisorData.createdAt,
        updatedAt: supervisorData.updatedAt
      }
    });
  } catch (error) {
    console.error('Error fetching supervisor profile:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ✅ SUPERVISOR PASSWORD UPDATE ENDPOINT
app.put('/api/supervisor/update-password', authenticateUser, async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    const userEmail = req.user.email;

    // Verify the email matches the authenticated user
    if (email !== userEmail) {
      return res.status(403).json({
        success: false,
        error: 'Email mismatch'
      });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long'
      });
    }

    // Update password in supervisors collection
    const supervisorSnap = await adminDb
      .collection('supervisors')
      .where('email', '==', email)
      .get();

    if (supervisorSnap.empty) {
      return res.status(404).json({
        success: false,
        error: 'Supervisor not found'
      });
    }

    const supervisorDoc = supervisorSnap.docs[0];
    await adminDb
      .collection('supervisors')
      .doc(supervisorDoc.id)
      .update({
        password: newPassword,
        updatedAt: new Date()
      });

    console.log('✅ Password updated for supervisor:', email);
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating supervisor password:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ✅ STUDENT REPOSITORIES ENDPOINT
app.get('/api/student-repositories/:studentUID', authenticateUser, async (req, res) => {
  try {
    const { studentUID } = req.params;
    const supervisorUID = req.user.uid;

    // Verify supervisor has access to this student
    const connectionSnap = await adminDb
      .collection('connections')
      .where('studentUID', '==', studentUID)
      .where('supervisorUID', '==', supervisorUID)
      .where('status', '==', 'active')
      .get();

    if (connectionSnap.empty) {
      return res.status(403).json({
        success: false,
        error: 'Access denied - not connected to this student'
      });
    }

    // Get student repositories
    const reposSnap = await adminDb
      .collection('team_repositories')
      .where('studentUID', '==', studentUID)
      .get();

    const repositories = reposSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt
    }));

    console.log('✅ Student repositories fetched:', repositories.length, 'repos for student:', studentUID);
    res.json({ success: true, data: repositories });
  } catch (error) {
    console.error('Error fetching student repositories:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ✅ STUDENT STATUS ENDPOINT
app.get('/api/student/status', authenticateUser, async (req, res) => {
  try {
    const studentUID = req.user.uid;

    // Check for active connections
    const activeConnectionSnap = await adminDb
      .collection('connections')
      .where('studentUID', '==', studentUID)
      .where('status', '==', 'active')
      .get();

    // Check for pending requests
    const pendingRequestSnap = await adminDb
      .collection('connection_requests')
      .where('studentUID', '==', studentUID)
      .where('status', '==', 'pending')
      .get();

    const hasActiveConnection = !activeConnectionSnap.empty;
    const hasPendingRequest = !pendingRequestSnap.empty;

    console.log('✅ Student status checked:', {
      studentUID,
      hasActiveConnection,
      hasPendingRequest
    });

    res.json({
      success: true,
      data: {
        hasActiveConnection,
        hasPendingRequest,
        activeConnections: activeConnectionSnap.docs.length,
        pendingRequests: pendingRequestSnap.docs.length
      }
    });
  } catch (error) {
    console.error('Error checking student status:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ✅ REPOSITORY SEARCH ENDPOINT
app.get('/api/repositories/search', authenticateUser, async (req, res) => {
  try {
    const { owner } = req.query;

    if (!owner) {
      return res.status(400).json({
        success: false,
        error: 'Owner parameter required'
      });
    }

    // Search repositories by owner
    const reposSnap = await adminDb
      .collection('team_repositories')
      .where('owner', '==', owner)
      .get();

    const repositories = reposSnap.docs.map(doc => {
      const data = doc.data();
      const repoName = data.repoName || data.rep0Name;
      return {
        id: doc.id,
        name: repoName,
        ...data,
        timestamp: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
      };
    });

    console.log('✅ Repository search completed:', repositories.length, 'repos found for owner:', owner);
    res.json({ success: true, data: repositories });
  } catch (error) {
    console.error('Error searching repositories:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ✅ REPOSITORY SAVE ENDPOINT
app.post('/api/repositories/save', authenticateUser, async (req, res) => {
  try {
    const { repoName, owner, teamMembers, repoData } = req.body;
    const studentUID = req.user.uid;

    if (!repoName || !owner) {
      return res.status(400).json({
        success: false,
        error: 'Repository name and owner required'
      });
    }

    // Save repository data
    const repositoryData = {
      repoName: repoName,
      owner: owner,
      studentUID: studentUID,
      teamMembers: teamMembers || [],
      updatedAt: new Date(),
      createdAt: new Date(),
      repoData: repoData || {}
    };

    await adminDb
      .collection('team_repositories')
      .doc(repoName)
      .set(repositoryData, { merge: true });

    console.log('✅ Repository saved:', repoName, 'for student:', studentUID);
    res.json({ success: true, message: 'Repository saved successfully' });
  } catch (error) {
    console.error('Error saving repository:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ✅ REPOSITORY VALIDATION ENDPOINT (NEW)
app.post('/api/validate-repository', authenticateUser, async (req, res) => {
  try {
    const { repoName, username } = req.body;

    if (!repoName || !username) {
      return res.status(400).json({
        success: false,
        error: 'Repository name and username required'
      });
    }

    console.log('🔍 Validating repository:', repoName, 'for user:', username);

    // GitHub API calls to validate repository
    const repoUrl = `https://api.github.com/repos/${username}/${repoName}`;
    const contributorsUrl = `https://api.github.com/repos/${username}/${repoName}/contributors`;

    try {
      // Fetch repository info
      const repoResponse = await fetch(repoUrl);
      if (!repoResponse.ok) {
        throw new Error(`Repository not found: ${repoResponse.status}`);
      }
      const repoData = await repoResponse.json();

      // Fetch contributors
      const contributorsResponse = await fetch(contributorsUrl);
      if (!contributorsResponse.ok) {
        throw new Error(`Contributors not found: ${contributorsResponse.status}`);
      }
      const contributors = await contributorsResponse.json();

      console.log('✅ Repository validated successfully:', repoName);
      res.json({
        success: true,
        data: {
          repository: repoData,
          contributors: contributors
        }
      });
    } catch (githubError) {
      console.error('GitHub API error:', githubError);
      res.status(404).json({
        success: false,
        error: `GitHub API error: ${githubError.message}`
      });
    }
  } catch (error) {
    console.error('Error validating repository:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ✅ CONTRIBUTORS STATS ENDPOINT
app.get('/api/contributors/:owner/:repo', authenticateUser, async (req, res) => {
  try {
    const { owner, repo } = req.params;

    console.log('📊 Fetching contributor stats for:', `${owner}/${repo}`);

    const contributorsUrl = `https://api.github.com/repos/${owner}/${repo}/contributors`;

    try {
      const response = await fetch(contributorsUrl);
      if (!response.ok) {
        throw new Error(`Contributors not found: ${response.status}`);
      }

      const contributors = await response.json();

      console.log('✅ Contributors fetched successfully:', contributors.length);
      res.json({
        success: true,
        data: contributors
      });
    } catch (githubError) {
      console.error('GitHub API error:', githubError);
      res.status(404).json({
        success: false,
        error: `GitHub API error: ${githubError.message}`
      });
    }
  } catch (error) {
    console.error('Error fetching contributors:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ✅ FEEDBACK EVALUATION ENDPOINTS

// GET /api/feedback/student/:email - Get student's feedback evaluations
// ✅ GET /api/feedback/student/:email - Get student's feedback

// GET /api/feedback/student/:email - Get student's feedback evaluations
// app.get('/api/feedback/student/:email', authenticateUser, async (req, res) => {
//   try {
//     const { email } = req.params;
//     const userEmail = req.user.email;

//     // Verify user can access this student's feedback
//     if (email !== userEmail) {
//       return res.status(403).json({
//         success: false,
//         error: 'Access denied - can only access your own feedback'
//       });
//     }

//     // Get feedback evaluations for this student
//     const feedbackSnap = await adminDb
//       .collection('feedbackEvaluation')
//       .where('studentEmail', '==', email)
//       .get();

//     const feedbackList = feedbackSnap.docs.map(doc => ({
//       id: doc.id,
//       ...doc.data(),
//       timestamp: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt
//     }));

//     console.log('✅ Student feedback fetched:', feedbackList.length, 'items for:', email);
//     res.json({ success: true, data: feedbackList });
//   } catch (error) {
//     console.error('Error fetching student feedback:', error);
//     res.status(500).json({ success: false, error: 'Internal server error' });
//   }
// });

// // GET /api/feedback/supervisor/:email - Get supervisor's feedback evaluations
// app.get('/api/feedback/supervisor/:email', authenticateUser, async (req, res) => {
//   try {
//     const { email } = req.params;
//     const userEmail = req.user.email;

//     // Verify user can access this supervisor's feedback
//     if (email !== userEmail) {
//       return res.status(403).json({
//         success: false,
//         error: 'Access denied - can only access your own feedback'
//       });
//     }

//     // Get feedback evaluations for this supervisor
//     const feedbackSnap = await adminDb
//       .collection('feedbackEvaluation')
//       .where('supervisorEmail', '==', email)
//       .get();

//     const feedbackList = feedbackSnap.docs.map(doc => ({
//       id: doc.id,
//       ...doc.data(),
//       timestamp: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt
//     }));

//     console.log('✅ Supervisor feedback fetched:', feedbackList.length, 'items for:', email);
//     res.json({ success: true, data: feedbackList });
//   } catch (error) {
//     console.error('Error fetching supervisor feedback:', error);
//     res.status(500).json({ success: false, error: 'Internal server error' });
//   }
// });

// // POST /api/feedback/submit - Submit feedback (student or supervisor)
// app.post('/api/feedback/submit', authenticateUser, async (req, res) => {
//   try {
//     const { studentEmail, supervisorEmail, type } = req.body;
//     const userEmail = req.user.email;

//     if (!studentEmail || !supervisorEmail || !type) {
//       return res.status(400).json({
//         success: false,
//         error: 'Student email, supervisor email, and type required'
//       });
//     }

//     // Verify user permission based on type
//     if (type === 'student' && studentEmail !== userEmail) {
//       return res.status(403).json({
//         success: false,
//         error: 'Students can only submit their own feedback'
//       });
//     }

//     if (type === 'supervisor' && supervisorEmail !== userEmail) {
//       return res.status(403).json({
//         success: false,
//         error: 'Supervisors can only submit their own evaluations'
//       });
//     }

//     // Create document ID
//     const sanitizedStudent = studentEmail.replace(/[.#$[\]@]/g, '_');
//     const sanitizedSupervisor = supervisorEmail.replace(/[.#$[\]@]/g, '_');
//     const docId = `${sanitizedStudent}_${sanitizedSupervisor}`;

//     // Prepare data based on type
//     let updateData = {
//       studentEmail,
//       supervisorEmail,
//       createdAt: new Date()
//     };

//     if (type === 'student') {
//       const { ratingByStudent, feedbackByStudent } = req.body;
//       updateData.ratingByStudent = ratingByStudent;
//       updateData.feedbackByStudent = feedbackByStudent;
//     } else if (type === 'supervisor') {
//       const { evaluationBySupervisor, grade } = req.body;
//       updateData.evaluationBySupervisor = evaluationBySupervisor;
//       updateData.grade = grade;
//     }

//     // Save to Firestore
//     await adminDb
//       .collection('feedbackEvaluation')
//       .doc(docId)
//       .set(updateData, { merge: true });

//     console.log('✅ Feedback submitted:', type, 'for document:', docId);
//     res.json({ success: true, message: 'Feedback submitted successfully' });
//   } catch (error) {
//     console.error('Error submitting feedback:', error);
//     res.status(500).json({ success: false, error: 'Internal server error' });
//   }
// });

// // GET /api/feedback/test - Test endpoint
// app.get('/api/feedback/test', (req, res) => {
//   res.json({
//     success: true,
//     message: 'Feedback API is working!',
//     timestamp: new Date().toISOString()
//   });
// });

// // DELETE /api/feedback/clear/:email - Clear all feedback for supervisor
// app.delete('/api/feedback/clear/:email', authenticateUser, async (req, res) => {
//   try {
//     const { email } = req.params;
//     const userEmail = req.user.email;

//     // Verify user can clear this supervisor's feedback
//     if (email !== userEmail) {
//       return res.status(403).json({
//         success: false,
//         error: 'Access denied - can only clear your own feedback'
//       });
//     }

//     // Get all feedback documents for this supervisor
//     const feedbackSnap = await adminDb
//       .collection('feedbackEvaluation')
//       .where('supervisorEmail', '==', email)
//       .get();

//     if (feedbackSnap.empty) {
//       return res.json({
//         success: true,
//         message: 'No feedback to clear',
//         deletedCount: 0
//       });
//     }

//     // Delete all documents
//     const batch = adminDb.batch();
//     feedbackSnap.docs.forEach(doc => {
//       batch.delete(doc.ref);
//     });

//     await batch.commit();

//     console.log('✅ Feedback cleared for supervisor:', email, 'Count:', feedbackSnap.docs.length);
//     res.json({
//       success: true,
//       message: `All feedback cleared successfully! (${feedbackSnap.docs.length} items deleted)`,
//       deletedCount: feedbackSnap.docs.length
//     });
//   } catch (error) {
//     console.error('Error clearing feedback:', error);
//     res.status(500).json({ success: false, error: 'Internal server error' });
//   }
// });

// // DELETE /api/feedback/clear-student/:email - Clear all evaluations for student
// app.delete('/api/feedback/clear-student/:email', authenticateUser, async (req, res) => {
//   try {
//     const { email } = req.params;
//     const userEmail = req.user.email;

//     // Verify user can clear this student's evaluations
//     if (email !== userEmail) {
//       return res.status(403).json({
//         success: false,
//         error: 'Access denied - can only clear your own evaluations'
//       });
//     }

//     // Get all feedback documents for this student
//     const feedbackSnap = await adminDb
//       .collection('feedbackEvaluation')
//       .where('studentEmail', '==', email)
//       .get();

//     if (feedbackSnap.empty) {
//       return res.json({
//         success: true,
//         message: 'No evaluations to clear',
//         deletedCount: 0
//       });
//     }

//     // Delete all documents
//     const batch = adminDb.batch();
//     feedbackSnap.docs.forEach(doc => {
//       batch.delete(doc.ref);
//     });

//     await batch.commit();

//     console.log('✅ Evaluations cleared for student:', email, 'Count:', feedbackSnap.docs.length);
//     res.json({
//       success: true,
//       message: `All evaluations cleared successfully! (${feedbackSnap.docs.length} items deleted)`,
//       deletedCount: feedbackSnap.docs.length
//     });
//   } catch (error) {
//     console.error('Error clearing evaluations:', error);
//     res.status(500).json({ success: false, error: 'Internal server error' });
//   }
// });

// // ✅ SECURE CONNECTION REQUEST ENDPOINTS

// // GET: Get connection requests for supervisor
// app.get('/api/connection-requests', authenticateUser, async (req, res) => {
//   try {
//     const supervisorUID = req.user.uid;
//     const supervisorEmail = req.user.email;
//     const safeSupervisorEmail = supervisorEmail.replace(/\./g, '_').replace(/@/g, '_');

//     console.log('🔍 Fetching requests for supervisor:', supervisorEmail);

//     // Query by email and safe email
//     const requestsSnap = await adminDb
//       .collection('connection_requests')
//       .where('status', '==', 'pending')
//       .get();

//     // Filter results for this supervisor only
//     const requests = [];
//     requestsSnap.forEach(doc => {
//       const data = doc.data();
//       if (data.supervisorEmail === supervisorEmail ||
//           data.safeSupervisorEmail === safeSupervisorEmail) {
//         requests.push({
//           id: doc.id,
//           ...data,
//           timestamp: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
//         });
//       }
//     });

//     console.log('✅ Found requests:', requests.length);
//     res.json({ success: true, data: requests });
//   } catch (error) {
//     console.error('Error fetching connection requests:', error);
//     res.status(500).json({ success: false, error: 'Internal server error' });
//   }
// });

// POST: Create connection request (student)
app.post('/api/connection-requests', authenticateUser, async (req, res) => {
  try {
    const { supervisorEmail } = req.body;
    const studentUID = req.user.uid;
    const studentEmail = req.user.email;

    if (!supervisorEmail) {
      return res.status(400).json({
        success: false,
        error: 'Supervisor email required'
      });
    }

    // Check if request already exists
    const existingSnap = await adminDb
      .collection('connection_requests')
      .where('studentUID', '==', studentUID)
      .where('supervisorEmail', '==', supervisorEmail.toLowerCase())
      .where('status', '==', 'pending')
      .get();

    if (!existingSnap.empty) {
      return res.status(400).json({
        success: false,
        error: 'Request already exists'
      });
    }

    const supervisorEmailLower = supervisorEmail.trim().toLowerCase();
    const requestData = {
      studentUID,
      studentEmail,
      supervisorEmail: supervisorEmailLower,
      status: 'pending',
      createdAt: new Date(),
      safeStudentEmail: studentEmail.replace(/\./g, '_').replace(/@/g, '_'),
      safeSupervisorEmail: supervisorEmailLower.replace(/\./g, '_').replace(/@/g, '_')
    };

    const docRef = await adminDb.collection('connection_requests').add(requestData);

    console.log('✅ Connection request created:', docRef.id);
    res.json({ success: true, requestId: docRef.id });
  } catch (error) {
    console.error('Error creating connection request:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT: Update connection request (supervisor approve/reject)
app.put('/api/connection-requests/:requestId', authenticateUser, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status } = req.body; // 'accepted' or 'rejected'
    const supervisorUID = req.user.uid;
    const supervisorEmail = req.user.email;

    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    // Get request document
    const requestDoc = await adminDb.collection('connection_requests').doc(requestId).get();

    if (!requestDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Request not found'
      });
    }

    const requestData = requestDoc.data();
    const safeSupervisorEmail = supervisorEmail.replace(/\./g, '_').replace(/@/g, '_');

    // Verify supervisor has permission to update this request
    if (requestData.supervisorEmail !== supervisorEmail &&
        requestData.safeSupervisorEmail !== safeSupervisorEmail) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Update request status
    await adminDb.collection('connection_requests').doc(requestId).update({
      status,
      decisionDate: new Date(),
      updatedAt: new Date()
    });

    // If accepted, create connection
    if (status === 'accepted') {
      const connectionId = `${requestData.studentUID}_${supervisorUID}`;
      await adminDb.collection('connections').doc(connectionId).set({
        studentUID: requestData.studentUID,
        studentEmail: requestData.studentEmail,
        supervisorUID,
        supervisorEmail,
        createdAt: new Date(),
        status: 'active'
      });

      console.log('✅ Connection created:', connectionId);
    }

    console.log('✅ Request updated:', requestId, status);
    res.json({ success: true, status });
  } catch (error) {
    console.error('Error updating connection request:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET: Get active connections for supervisor
app.get('/api/connections', authenticateUser, async (req, res) => {
  try {
    const supervisorUID = req.user.uid;

    const connectionsSnap = await adminDb
      .collection('connections')
      .where('supervisorUID', '==', supervisorUID)
      .where('status', '==', 'active')
      .get();

    const connections = connectionsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt
    }));

    console.log('✅ Found connections:', connections.length);
    res.json({ success: true, data: connections });
  } catch (error) {
    console.error('Error fetching connections:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});












// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});