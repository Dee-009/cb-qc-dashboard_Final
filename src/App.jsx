import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Remakes from './pages/InternalRemakes';
import QCLogPage from './pages/QCLogPage';
import MRBBoard from './pages/MRBBoard';
import LeadershipDashboard from './pages/LeadershipDashboard';
import QCControlDashboard from './pages/QCControlDashboard';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: true } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/"            element={<LeadershipDashboard />} />
            <Route path="/remakes"     element={<Remakes />} />
            <Route path="/qc-control"  element={<QCControlDashboard />} />
            <Route path="/log-reject"  element={<QCLogPage />} />
            <Route path="/mrb"         element={<MRBBoard />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}
