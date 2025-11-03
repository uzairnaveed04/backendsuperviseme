import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 1. Create the Context
export const ProjectContext = createContext();

// 2. Create a Provider Component
export const ProjectProvider = ({ children }) => {
  const [hiddenRequests, setHiddenRequests] = useState([]);
  const [hiddenProjects, setHiddenProjects] = useState([]);

  const STORAGE_KEYS = {
    HIDDEN_REQUESTS: 'hiddenRequests',
    HIDDEN_PROJECTS: 'hiddenProjects',
  };

  // 3. Load data from AsyncStorage on app start
  useEffect(() => {
    const loadHiddenData = async () => {
      try {
        const storedRequests = await AsyncStorage.getItem(STORAGE_KEYS.HIDDEN_REQUESTS);
        const storedProjects = await AsyncStorage.getItem(STORAGE_KEYS.HIDDEN_PROJECTS);
        if (storedRequests) {
          setHiddenRequests(JSON.parse(storedRequests));
        }
        if (storedProjects) {
          setHiddenProjects(JSON.parse(storedProjects));
        }
      } catch (e) {
        console.error("Failed to load hidden data from storage", e);
      }
    };
    loadHiddenData();
  }, []);

  // 4. Update AsyncStorage whenever hidden states change
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEYS.HIDDEN_REQUESTS, JSON.stringify(hiddenRequests));
  }, [hiddenRequests]);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEYS.HIDDEN_PROJECTS, JSON.stringify(hiddenProjects));
  }, [hiddenProjects]);

  // 5. Functions to update the global state
  // These now accept the arrays as arguments
  const clearAllRequests = (requestsToHide) => {
    setHiddenRequests(prev => [...prev, ...requestsToHide.map(r => r.id)]);
  };
  const clearAllProjects = (projectsToHide) => {
    setHiddenProjects(prev => [...prev, ...projectsToHide.map(p => p.id)]);
  };
  const deleteRequest = (requestId) => setHiddenRequests(prev => [...prev, requestId]);
  const deleteProject = (projectId) => setHiddenProjects(prev => [...prev, projectId]);

  return (
    <ProjectContext.Provider value={{
      hiddenRequests,
      hiddenProjects,
      deleteRequest,
      deleteProject,
      clearAllRequests,
      clearAllProjects
    }}>
      {children}
    </ProjectContext.Provider>
  );
};