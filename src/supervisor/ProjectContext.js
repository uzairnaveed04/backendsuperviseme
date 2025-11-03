// src/context/ProjectContext.js

import React, { createContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  query,
  onSnapshot,
  where,
  getDocs,
  limit
} from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';

export const ProjectContext = createContext();

export const ProjectProvider = ({ children }) => {
  const [assignedRequests, setAssignedRequests] = useState([]);
  const [supervisorEmail, setSupervisorEmail] = useState(null);

  // Get the supervisor's email
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setSupervisorEmail(user.email.trim().toLowerCase());
      } else {
        setSupervisorEmail(null);
      }
    });
    return unsubscribe;
  }, []);

  // Set up the single, efficient real-time listener for assigned projects
  useEffect(() => {
    if (!supervisorEmail) {
      setAssignedRequests([]);
      return;
    }

    // This is the correct way to listen for all assigned projects in one query.
    const q = query(
      collection(db, 'projects'),
      where('supervisorEmail', '==', supervisorEmail)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const assignedIds = snapshot.docs
        .filter(doc => doc.data().assignedFromRequest) // Only care about projects from a request
        .map(doc => doc.data().requestId); // Extract the requestId
      
      console.log("Assigned Requests updated:", assignedIds); // For debugging
      setAssignedRequests(assignedIds);
    });

    return unsubscribe;
  }, [supervisorEmail]);

  // Provide the state and functions to children
  return (
    <ProjectContext.Provider value={{ assignedRequests, setAssignedRequests }}>
      {children}
    </ProjectContext.Provider>
  );
};