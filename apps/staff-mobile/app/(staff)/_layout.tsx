import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { colors } from '../../src/theme';

const SUPERVISOR_ROLES = ['SUPERVISOR', 'HEAD_OF_DEPT', 'GENERAL_MANAGER'];

export default function StaffLayout() {
  const { staff } = useAuthStore();
  const isSupervisor = staff ? SUPERVISOR_ROLES.includes(staff.role) : false;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="assignment" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="kanban"
        options={{
          title: 'Board',
          href: isSupervisor ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="view-column" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="team"
        options={{
          title: 'Team',
          href: isSupervisor ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="people" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="housekeeping"
        options={{
          title: 'Rooms',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="hotel" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
