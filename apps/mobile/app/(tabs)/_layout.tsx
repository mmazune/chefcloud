import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#0033FF',
        tabBarStyle: {
          backgroundColor: '#FFF',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'KPIs',
          headerTitle: 'Dashboard',
        }}
      />
      <Tabs.Screen
        name="stock"
        options={{
          title: 'Stock',
          headerTitle: 'Stock Count',
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          headerTitle: 'Anomaly Alerts',
        }}
      />
    </Tabs>
  );
}
