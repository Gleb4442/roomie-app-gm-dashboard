import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/stores/authStore';

export default function Index() {
  const { staff, isLoading } = useAuthStore();

  if (isLoading) return null;

  if (staff) return <Redirect href="/(staff)/tasks" />;
  return <Redirect href="/(auth)/login" />;
}
