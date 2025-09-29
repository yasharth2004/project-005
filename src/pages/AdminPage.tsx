import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AdminDashboard from '../components/AdminDashboard';
import AppLayout from '../components/AppLayout';

const AdminPage: React.FC = () => {
  const { user, isAuthenticated } = useAuthStore();

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to home if not admin
  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <AppLayout>
      <AdminDashboard />
    </AppLayout>
  );
};

export default AdminPage;
